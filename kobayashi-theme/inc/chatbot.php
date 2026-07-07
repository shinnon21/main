<?php
/**
 * AIチャットボット（Vertex AI / Gemini）
 *
 * - サイト右下のチャットウィジェットから REST（kobayashi/v1/chat）で受け、
 *   Vertex AI generateContent を呼んで回答を返す
 * - 「創作しない」ためのグラウンディング: プロフィール・実績・コラム・お知らせ等の
 *   掲載情報を丸ごとシステムプロンプトへ注入し、掲載情報のみを根拠に回答させる
 *   （掲載にない事柄は回答せず、お問い合わせフォームへ誘導）。temperature=0
 * - 認証: GCE VMのメタデータサーバーからアクセストークン取得（ライブラリ不要）。
 *   非GCE環境やスコープ変更前はAPIキー（Vertex AI Express）でも動く
 * - コスト防御: IP毎 分/日＋サイト全体 日次のレート制限（transient）
 * - 設定: 管理画面「設定 → AIチャットボット」（有効化・プロジェクト・モデル・接続テスト）
 * - GCP側の準備は「チャットボット導入手順.md」参照（API有効化・SAロール・スコープ）
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/* ---------- 設定 ---------- */
function kb_chatbot_settings() {
	$s = get_option( 'kb_chatbot_settings', array() );
	return wp_parse_args( is_array( $s ) ? $s : array(), array(
		'enabled'  => 0,
		'project'  => 'shinnosuke-kbys',
		'location' => 'global',
		'model'    => 'gemini-2.5-flash-lite',
		'api_key'  => '',
	) );
}
function kb_chatbot_enabled() {
	$s = kb_chatbot_settings();
	return ! empty( $s['enabled'] ) && ! empty( $s['project'] ) && ! empty( $s['model'] );
}

/* ---------- RESTエンドポイント ---------- */
add_action( 'rest_api_init', function () {
	register_rest_route( 'kobayashi/v1', '/chat', array(
		'methods'             => 'POST',
		'permission_callback' => '__return_true',
		'callback'            => 'kb_chatbot_rest',
		'args'                => array(
			'message' => array( 'type' => 'string', 'required' => true ),
			'history' => array( 'type' => 'array', 'required' => false ),
			'lang'    => array( 'type' => 'string', 'required' => false ),
		),
	) );
} );

function kb_chatbot_rest( WP_REST_Request $req ) {
	if ( ! kb_chatbot_enabled() ) {
		return new WP_REST_Response( array( 'error' => 'disabled' ), 503 );
	}

	/* 同一オリジンチェック（ヘッダーがあるブラウザ経由のみ検査） */
	$origin = $req->get_header( 'origin' );
	$origin = $origin ? $origin : $req->get_header( 'referer' );
	if ( $origin && wp_parse_url( $origin, PHP_URL_HOST ) !== wp_parse_url( home_url(), PHP_URL_HOST ) ) {
		return new WP_REST_Response( array( 'error' => 'forbidden' ), 403 );
	}

	/* レート制限（IP毎 分/日＋サイト全体 日次） */
	$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
	$id = md5( $ip );
	if ( ! kb_chatbot_hit( 'kb_chat_m_' . $id, 8, MINUTE_IN_SECONDS )
		|| ! kb_chatbot_hit( 'kb_chat_d_' . $id, 40, DAY_IN_SECONDS )
		|| ! kb_chatbot_hit( 'kb_chat_g', 800, DAY_IN_SECONDS ) ) {
		return new WP_REST_Response( array( 'error' => 'rate_limited' ), 429 );
	}

	$message = trim( wp_strip_all_tags( (string) $req->get_param( 'message' ) ) );
	if ( '' === $message ) {
		return new WP_REST_Response( array( 'error' => 'empty' ), 400 );
	}
	if ( mb_strlen( $message ) > 800 ) {
		return new WP_REST_Response( array( 'error' => 'too_long' ), 400 );
	}

	/* 会話履歴（直近10件・各1500字まで。roleはuser/modelのみ許可） */
	$history = array();
	$raw     = $req->get_param( 'history' );
	if ( is_array( $raw ) ) {
		foreach ( array_slice( $raw, -10 ) as $h ) {
			if ( ! is_array( $h ) || empty( $h['text'] ) || ! is_string( $h['text'] ) ) { continue; }
			$role = ( isset( $h['role'] ) && 'model' === $h['role'] ) ? 'model' : 'user';
			$history[] = array( 'role' => $role, 'text' => mb_substr( wp_strip_all_tags( $h['text'] ), 0, 1500 ) );
		}
	}

	$lang = ( 'en' === $req->get_param( 'lang' ) ) ? 'en' : 'ja';
	$res  = kb_chatbot_generate( $message, $history, $lang );

	if ( empty( $res['ok'] ) ) {
		return new WP_REST_Response( array( 'error' => $res['code'] ), 502 );
	}
	return new WP_REST_Response( array( 'reply' => $res['reply'] ), 200 );
}

/* 固定ウィンドウのカウンター（上限内ならtrue）。
   transientのread-modify-writeは並列リクエストで上限を素通しできるため、
   optionsテーブルへのアトミック加算で数える。行名の先頭に期限タイムスタンプを
   持たせ、期限切れバケットは低頻度でまとめて掃除する */
function kb_chatbot_hit( $key, $limit, $window ) {
	global $wpdb;
	$end  = ( (int) floor( time() / $window ) + 1 ) * $window;
	$name = sprintf( '_kb_rl_%010d_%s', $end, $key );
	$wpdb->query( $wpdb->prepare(
		"INSERT INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, '1', 'no')
		 ON DUPLICATE KEY UPDATE option_value = option_value + 1",
		$name
	) );
	$n = (int) $wpdb->get_var( $wpdb->prepare(
		"SELECT option_value FROM {$wpdb->options} WHERE option_name = %s",
		$name
	) );
	if ( 1 === mt_rand( 1, 20 ) ) {
		$wpdb->query( $wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE '\_kb\_rl\_%%' AND option_name < %s",
			sprintf( '_kb_rl_%010d', time() )
		) );
	}
	return $n > 0 && $n <= $limit;
}

/* ---------- 回答生成 ---------- */
function kb_chatbot_generate( $message, $history, $lang ) {
	$s = kb_chatbot_settings();

	$contact = home_url( 'en' === $lang ? '/en/contact/' : '/contact/' );
	$system  = implode( "\n", array(
		'あなたは「小林慎之助」本人として、公式ホームページ（' . home_url( '/' ) . '）を訪れた人と会話するAIアバターです。以下のルールを必ず守ってください。',
		'1. 一人称「私」で、小林慎之助本人になりきり、親しみやすく丁寧な口調で会話すること。',
		'2. ただし発言は、このプロンプト末尾の【公式サイト掲載情報】に書かれた事実だけに基づくこと。掲載情報にない経歴・実績・意見・感想を、推測・想像・一般知識で補って創作してはならない。',
		'3. 掲載情報で答えられない質問には、正直に「そこまではこのサイトに載せていないんです」と伝えたうえで、お問い合わせフォーム（' . $contact . '）から連絡してほしいと案内すること。',
		'4. 数値・日付・固有名詞は掲載情報の表記をそのまま使い、言い換え・概算・四捨五入をしないこと。',
		'5. 私（小林慎之助）やWeeave株式会社、このサイトと関係のない依頼（一般的な調べ物、文章やコードの作成、翻訳、創作など）には応じず、私自身やこのサイトについて聞いてほしいと丁寧に伝えること。',
		'6. 回答は簡潔に（目安300字以内）。関連ページがあれば、そのURLを1つだけ、必ず「https://」から始まる完全な形で添えてよい（掲載情報にあるURLのみ）。',
		'7. 項目を並べるときは各行を「- 」で始め、強調したい語は **太字** にしてよい（Markdown記法で書く）。',
		'8. ' . ( 'en' === $lang ? 'Respond in English, speaking as Shinnosuke Kobayashi in the first person.' : '日本語で回答すること。' ),
		'',
		kb_chatbot_corpus( $lang ),
	) );

	$contents = array();
	foreach ( $history as $h ) {
		$contents[] = array( 'role' => $h['role'], 'parts' => array( array( 'text' => $h['text'] ) ) );
	}
	$contents[] = array( 'role' => 'user', 'parts' => array( array( 'text' => $message ) ) );

	/* 認証: APIキー設定時はそれを優先。なければGCEメタデータサーバーのトークン */
	$headers = array( 'Content-Type' => 'application/json; charset=utf-8' );
	if ( ! empty( $s['api_key'] ) ) {
		$headers['x-goog-api-key'] = $s['api_key'];
	} else {
		$token = kb_chatbot_gce_token();
		if ( ! $token ) {
			return array( 'ok' => false, 'code' => 'auth' );
		}
		$headers['Authorization'] = 'Bearer ' . $token;
	}

	if ( ! empty( $s['api_key'] ) ) {
		/* APIキー（Express）はprojects/locations付きのリソースパスでは401で拒否される。
		   publisherスコープのグローバルエンドポイント限定（ロケーション設定は無視） */
		$url = sprintf(
			'https://aiplatform.googleapis.com/v1/publishers/google/models/%s:generateContent',
			rawurlencode( $s['model'] )
		);
	} else {
		$loc  = $s['location'] ? $s['location'] : 'global';
		$host = ( 'global' === $loc ) ? 'aiplatform.googleapis.com' : $loc . '-aiplatform.googleapis.com';
		$url  = sprintf(
			'https://%s/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent',
			$host, rawurlencode( $s['project'] ), rawurlencode( $loc ), rawurlencode( $s['model'] )
		);
	}

	$body = array(
		'system_instruction' => array( 'parts' => array( array( 'text' => $system ) ) ),
		'contents'           => $contents,
		'generationConfig'   => array(
			'temperature'     => 0,
			'maxOutputTokens' => 1024,
		),
	);

	$res = wp_remote_post( $url, array(
		'timeout' => 25,
		'headers' => $headers,
		'body'    => wp_json_encode( $body ),
	) );
	if ( is_wp_error( $res ) ) {
		error_log( 'kb_chatbot: ' . $res->get_error_message() );
		return array( 'ok' => false, 'code' => 'network' );
	}

	$code = wp_remote_retrieve_response_code( $res );
	$json = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( 200 !== $code ) {
		$msg = isset( $json['error']['message'] ) ? $json['error']['message'] : ( 'HTTP ' . $code );
		error_log( 'kb_chatbot: Vertex AI error: ' . $msg );
		if ( 429 === $code ) { return array( 'ok' => false, 'code' => 'quota' ); }
		/* 401/403＝ロール未付与・スコープ不足（トークン自体はスコープ不足でも発行される） */
		if ( 401 === $code || 403 === $code ) { return array( 'ok' => false, 'code' => 'perm' ); }
		return array( 'ok' => false, 'code' => 'api' );
	}

	$reply = '';
	if ( isset( $json['candidates'][0]['content']['parts'] ) && is_array( $json['candidates'][0]['content']['parts'] ) ) {
		foreach ( $json['candidates'][0]['content']['parts'] as $part ) {
			if ( isset( $part['text'] ) ) { $reply .= $part['text']; }
		}
	}
	$reply = trim( $reply );
	if ( '' === $reply ) {
		/* セーフティブロック等でテキストが返らないケース */
		return array( 'ok' => false, 'code' => 'blocked' );
	}
	return array( 'ok' => true, 'reply' => $reply );
}

/* GCEメタデータサーバーからアクセストークン取得（期限前までtransientでキャッシュ） */
function kb_chatbot_gce_token() {
	$cached = get_transient( 'kb_chatbot_token' );
	if ( is_string( $cached ) && '' !== $cached ) { return $cached; }

	foreach ( array( 'metadata.google.internal', '169.254.169.254' ) as $host ) {
		$res = wp_remote_get(
			'http://' . $host . '/computeMetadata/v1/instance/service-accounts/default/token',
			array( 'timeout' => 2, 'headers' => array( 'Metadata-Flavor' => 'Google' ) )
		);
		if ( is_wp_error( $res ) || 200 !== wp_remote_retrieve_response_code( $res ) ) { continue; }
		$json = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $json['access_token'] ) ) { continue; }
		$ttl = isset( $json['expires_in'] ) ? max( 60, (int) $json['expires_in'] - 120 ) : 600;
		set_transient( 'kb_chatbot_token', $json['access_token'], $ttl );
		return $json['access_token'];
	}
	return '';
}

/* ---------- グラウンディングコンテキスト（公式サイト掲載情報） ----------
   プロフィール・実績・コラム・お知らせ・固定ページの掲載内容をテキスト化。
   言語別に6時間キャッシュし、コンテンツ更新（save_post）で破棄する。
   EN版はテーマの英語メタ（title_en / content_en / client_name_en 等）と
   /en/ 付きURLを使い、未入力はJPへフォールバック。
   注意: 管理画面（接続テスト）からも生成されるため、post_status は必ず
   publish に固定し、パスワード保護記事は除外する（非公開情報の混入防止） */
function kb_chatbot_corpus( $lang = 'ja' ) {
	$en     = ( 'en' === $lang );
	$ckey   = 'kb_chatbot_corpus_' . ( $en ? 'en' : 'ja' );
	$cached = get_transient( $ckey );
	if ( is_string( $cached ) && '' !== $cached ) { return $cached; }

	/* メタの言語版（EN時は「<キー>_en」優先・空ならJP） */
	$mv = function ( $key, $id ) use ( $en ) {
		if ( $en ) {
			$v = kb_field( $key . '_en', $id );
			if ( is_string( $v ) && '' !== trim( $v ) ) { return trim( $v ); }
		}
		$v = kb_field( $key, $id );
		return is_string( $v ) ? trim( $v ) : $v;
	};
	/* EN時は掲載ページのURLも /en/ 付きに */
	$url = function ( $u ) use ( $en ) {
		return $en ? str_replace( home_url( '/' ), home_url( '/en/' ), $u ) : $u;
	};
	$title = function ( $post ) use ( $en ) {
		if ( $en ) {
			$t = get_post_meta( $post->ID, 'title_en', true );
			if ( is_string( $t ) && '' !== trim( $t ) ) { return trim( $t ); }
		}
		return $post->post_title;
	};
	$content = function ( $post ) use ( $en ) {
		if ( $en ) {
			$c = get_post_meta( $post->ID, 'content_en', true );
			if ( is_string( $c ) && '' !== trim( $c ) ) { return $c; }
		}
		return $post->post_content;
	};

	$L   = array();
	$L[] = '【公式サイト掲載情報】（以下がこのサイトに公開されている全情報。回答の根拠はここに限る）';
	$L[] = '';
	$L[] = '■ サイト: 小林慎之助 公式ホームページ ' . home_url( '/' ) . '（英語版 ' . home_url( '/en/' ) . '）';
	$L[] = '■ お問い合わせ: フォーム ' . home_url( ( $en ? '/en' : '' ) . '/contact/' ) . ' から（連絡手段はこのフォームを案内する）';

	/* プロフィール（管理画面編集の値。未保存時はテーマ初期値にフォールバック。
	   EN時の優先順は kb_profile_field() と同じ: ENメタ→EN初期値→JPメタ→JP初期値 */
	$pid = 0;
	$p   = get_page_by_path( 'profile' );
	if ( $p ) { $pid = $p->ID; }
	$pf = function ( $key ) use ( $pid, $en ) {
		if ( $en ) {
			$v = $pid ? kb_field( $key . '_en', $pid ) : '';
			if ( is_string( $v ) && '' !== trim( $v ) ) { return trim( $v ); }
			$d = kb_profile_defaults_en();
			if ( isset( $d[ $key ] ) ) { return $d[ $key ]; }
		}
		$v = $pid ? kb_field( $key, $pid ) : '';
		if ( is_string( $v ) && '' !== trim( $v ) ) { return trim( $v ); }
		$d = kb_profile_defaults();
		return isset( $d[ $key ] ) ? $d[ $key ] : '';
	};
	$L[] = '';
	$L[] = '■ プロフィール（' . home_url( ( $en ? '/en' : '' ) . '/profile/' ) . '）';
	$L[] = '氏名: ' . $pf( 'profile_name' ) . '（' . $pf( 'profile_kana' ) . '）';
	$L[] = '肩書き: ' . $pf( 'profile_role' );
	$L[] = '自己紹介: ' . $pf( 'profile_bio' );
	$L[] = '経歴（新しい順・「期間 | 役職 | 内容」）:';
	foreach ( preg_split( '/\r\n|\r|\n/', $pf( 'profile_career' ) ) as $line ) {
		if ( '' !== trim( $line ) ) { $L[] = '- ' . trim( $line ); }
	}
	$L[] = 'スキル・強み（「グループ | 内容」）:';
	foreach ( preg_split( '/\r\n|\r|\n/', $pf( 'profile_skills' ) ) as $line ) {
		if ( '' !== trim( $line ) ) { $L[] = '- ' . trim( $line ); }
	}
	$L[] = '研究テーマ: ' . $pf( 'profile_research_title' );
	$L[] = $pf( 'profile_research_body' );
	$L[] = '登壇・対外活動:';
	foreach ( preg_split( '/\r\n|\r|\n/', $pf( 'profile_activities' ) ) as $line ) {
		if ( '' !== trim( $line ) ) { $L[] = '- ' . trim( $line ); }
	}

	/* SNS・外部リンク（kb_sns_accounts が正） */
	$L[] = '';
	$L[] = '■ 公式SNS・関連リンク';
	if ( function_exists( 'kb_sns_accounts' ) ) {
		foreach ( kb_sns_accounts() as $a ) {
			if ( ! empty( $a['url'] ) ) { $L[] = '- ' . $a['label'] . ': ' . $a['url']; }
		}
	}
	$L[] = '- Weeave株式会社: https://www.weeave.co.jp/';

	/* 実績（公開済み全件） */
	$works = get_posts( array( 'post_type' => 'works', 'posts_per_page' => -1, 'orderby' => 'date', 'order' => 'DESC', 'post_status' => 'publish' ) );
	$works = array_values( array_filter( $works, function ( $w ) { return empty( $w->post_password ); } ) );
	$L[]   = '';
	$L[]   = '■ 実績一覧（全' . count( $works ) . '件・' . home_url( ( $en ? '/en' : '' ) . '/works/' ) . '）';
	foreach ( $works as $w ) {
		$L[] = '';
		$L[] = '▼ 実績: ' . $title( $w );
		$L[] = 'URL: ' . $url( get_permalink( $w ) );
		$meta = array(
			'クライアント' => $mv( 'client_name', $w->ID ),
			'期間'         => trim( kb_field( 'period_start', $w->ID ) . ( kb_field( 'period_start', $w->ID ) ? ' – ' . ( kb_field( 'period_end', $w->ID ) ? kb_field( 'period_end', $w->ID ) : ( $en ? 'present' : '現在' ) ) : '' ) ),
			'役割'         => $mv( 'role', $w->ID ),
			'使用技術'     => $mv( 'tech_stack', $w->ID ),
			'サイト'       => kb_field( 'site_url', $w->ID ),
		);
		$scope = kb_field( 'scope', $w->ID );
		if ( is_array( $scope ) && $scope ) { $meta['担当領域'] = implode( '／', $scope ); }
		foreach ( array( 'works_type' => '種別', 'industry' => '業界', 'skill' => 'タグ' ) as $tax => $label ) {
			$terms = get_the_terms( $w->ID, $tax );
			if ( $terms && ! is_wp_error( $terms ) ) { $meta[ $label ] = implode( '／', wp_list_pluck( $terms, 'name' ) ); }
		}
		foreach ( $meta as $k => $v ) {
			if ( is_string( $v ) && '' !== trim( $v ) ) { $L[] = $k . ': ' . trim( $v ); }
		}
		$kpis = $mv( 'kpi_results', $w->ID );
		if ( is_array( $kpis ) && $kpis ) {
			$pairs = array();
			foreach ( $kpis as $k ) {
				if ( ! empty( $k['value'] ) ) { $pairs[] = ( isset( $k['label'] ) ? $k['label'] . ' ' : '' ) . $k['value']; }
			}
			if ( $pairs ) { $L[] = '成果: ' . implode( '／', $pairs ); }
		}
		$excerpt = $en ? $mv( 'excerpt_en', $w->ID ) : '';
		$excerpt = ( is_string( $excerpt ) && '' !== $excerpt ) ? $excerpt : $w->post_excerpt;
		if ( '' !== trim( $excerpt ) ) { $L[] = '概要: ' . kb_chatbot_plain( $excerpt, 400 ); }
		$L[] = '本文: ' . kb_chatbot_plain( $content( $w ), 1600 );
	}

	/* コラム（公開済み） */
	$cols = get_posts( array( 'post_type' => 'column', 'posts_per_page' => 20, 'post_status' => 'publish' ) );
	$cols = array_filter( $cols, function ( $c ) { return empty( $c->post_password ); } );
	if ( $cols ) {
		$L[] = '';
		$L[] = '■ コラム（' . home_url( ( $en ? '/en' : '' ) . '/column/' ) . '）';
		foreach ( $cols as $c ) {
			$L[] = '';
			$L[] = '▼ コラム: ' . $title( $c ) . '（公開 ' . get_the_date( 'Y.m.d', $c ) . '）';
			$L[] = 'URL: ' . $url( get_permalink( $c ) );
			$L[] = kb_chatbot_plain( ( trim( $c->post_excerpt ) ? $c->post_excerpt . ' ' : '' ) . $content( $c ), 900 );
		}
	}

	/* お知らせ（公開済み） */
	$news = get_posts( array( 'post_type' => 'news', 'posts_per_page' => 30, 'post_status' => 'publish' ) );
	$news = array_filter( $news, function ( $n ) { return empty( $n->post_password ); } );
	if ( $news ) {
		$L[] = '';
		$L[] = '■ お知らせ（' . home_url( ( $en ? '/en' : '' ) . '/news/' ) . '）';
		foreach ( $news as $n ) {
			$types = get_the_terms( $n->ID, 'news_type' );
			$badge = ( $types && ! is_wp_error( $types ) ) ? '［' . $types[0]->name . '］' : '';
			$body  = kb_chatbot_plain( $content( $n ), 300 );
			$L[]   = '- ' . get_the_date( 'Y.m.d', $n ) . ' ' . $badge . $title( $n ) . ( $body ? '：' . $body : '' ) . '（' . $url( get_permalink( $n ) ) . '）';
		}
	}

	/* 固定ページ（About等。プロフィール・お問い合わせは上で扱い済みのため除外） */
	foreach ( array( 'about', 'privacy' ) as $slug ) {
		$page = get_page_by_path( $slug );
		if ( $page && 'publish' === $page->post_status && empty( $page->post_password ) && '' !== trim( $page->post_content ) ) {
			$L[] = '';
			$L[] = '■ 固定ページ: ' . $title( $page ) . '（' . $url( get_permalink( $page ) ) . '）';
			$L[] = kb_chatbot_plain( $content( $page ), 1200 );
		}
	}

	/* トークン量の安全上限（全体で約40,000字） */
	$corpus = implode( "\n", $L );
	if ( mb_strlen( $corpus ) > 40000 ) {
		$corpus = mb_substr( $corpus, 0, 40000 ) . "\n（以降省略）";
	}

	set_transient( $ckey, $corpus, 6 * HOUR_IN_SECONDS );
	return $corpus;
}

/* HTML→プレーンテキスト（ショートコード除去・空白正規化・字数上限） */
function kb_chatbot_plain( $html, $limit ) {
	$t = wp_strip_all_tags( strip_shortcodes( (string) $html ) );
	$t = trim( preg_replace( '/[ \t]*\n[ \t\n]*/', ' / ', preg_replace( '/[ \t]+/', ' ', $t ) ) );
	return mb_strlen( $t ) > $limit ? mb_substr( $t, 0, $limit ) . '…' : $t;
}

/* コンテンツ更新でコーパスキャッシュ（日英両方）を破棄 */
add_action( 'save_post', function ( $post_id, $post ) {
	if ( in_array( $post->post_type, array( 'works', 'column', 'news', 'page' ), true ) ) {
		delete_transient( 'kb_chatbot_corpus_ja' );
		delete_transient( 'kb_chatbot_corpus_en' );
	}
}, 10, 2 );

/* ---------- フロント（ウィジェット出力＋アセット） ---------- */
add_action( 'wp_enqueue_scripts', function () {
	if ( ! kb_chatbot_enabled() ) { return; }
	$cfg = array(
		'endpoint' => rest_url( 'kobayashi/v1/chat' ),
		'lang'     => kb_is_en() ? 'en' : 'ja',
		'strings'  => array(
			'error'   => kb_t( 'すみません、回答の取得に失敗しました。時間をおいてお試しください。', 'Sorry, something went wrong. Please try again later.' ),
			'limited' => kb_t( 'ご利用が集中しています。しばらくしてからお試しください。', 'The assistant is busy right now. Please try again in a while.' ),
		),
	);
	$ver = wp_get_theme()->get( 'Version' );
	/* 専用ページ（page-chat.php）では全画面チャットのみ。浮遊ウィジェットは出さない。
	   アバターはLottie（lottie.min.jsをローカル同梱・外部通信なし） */
	if ( kb_is_chat_page() ) {
		$uri = get_template_directory_uri();
		wp_enqueue_script( 'kb-lottie', $uri . '/assets/lottie.min.js', array(), '5.12.2', true );
		wp_enqueue_script( 'kb-chat-page', $uri . '/assets/chat-page.js', array( 'kb-lottie' ), $ver, true );
		$cfg['avatar'] = array(
			'idle'      => $uri . '/assets/avatar/avatar_idle.json?v=' . $ver,
			'thinking'  => $uri . '/assets/avatar/avatar_thinking.json?v=' . $ver,
			'answering' => $uri . '/assets/avatar/avatar_answering.json?v=' . $ver,
		);
		wp_localize_script( 'kb-chat-page', 'kbChatCfg', $cfg );
		return;
	}
	wp_enqueue_script( 'kb-chatbot', get_template_directory_uri() . '/assets/chatbot.js', array(), $ver, true );
	wp_localize_script( 'kb-chatbot', 'kbChatCfg', $cfg );
} );

add_action( 'wp_footer', function () {
	if ( ! kb_chatbot_enabled() || kb_is_chat_page() ) { return; }
	$face = kb_avatar_face_url(); // テーマ同梱の顔クロップ（本人写真）
	$suggests = array(
		kb_t( '実績を教えてください', 'Tell me about your work.' ),
		kb_t( '経歴について聞きたいです', "I'd like to hear about your career." ),
		kb_t( '仕事の相談をしたいです', "I'd like to discuss working together." ),
	);
	?>
	<div class="kb-chat" id="kbChat">
		<button type="button" class="kb-chat-fab<?php echo $face ? ' has-face' : ''; ?>" id="kbChatFab" aria-expanded="false" aria-controls="kbChatPanel" aria-label="<?php echo esc_attr( kb_t( '小林慎之助AIに質問する', 'Chat with Shinnosuke Kobayashi AI' ) ); ?>">
			<span class="kb-chat-fab-halo" aria-hidden="true"></span>
			<?php if ( $face ) : ?>
				<img class="kb-chat-fab-face" src="<?php echo esc_url( $face ); ?>" alt="" width="58" height="58">
			<?php else : ?>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
			<?php endif; ?>
			<span class="kb-chat-fab-badge">AI</span>
		</button>
		<section class="kb-chat-panel" id="kbChatPanel" role="dialog" aria-label="<?php echo esc_attr( kb_t( '小林慎之助AIアバター', 'Shinnosuke Kobayashi AI avatar' ) ); ?>" hidden>
			<header class="kb-chat-head">
				<span class="kb-chat-face">
					<span class="kb-chat-sonar" aria-hidden="true"></span>
					<?php if ( $face ) : ?><img src="<?php echo esc_url( $face ); ?>" alt="" width="40" height="40"><?php else : ?><span class="init">SK</span><?php endif; ?>
				</span>
				<span class="kb-chat-idwrap">
					<span class="kb-chat-title"><?php echo esc_html( kb_t( '小林慎之助', 'Shinnosuke Kobayashi' ) ); ?><small>AI</small></span>
					<span class="kb-chat-status">
						<span class="s-on"><?php echo esc_html( kb_t( 'オンライン', 'Online' ) ); ?></span>
						<span class="s-busy"><span class="kb-chat-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><?php echo esc_html( kb_t( '入力中…', 'Typing…' ) ); ?></span>
					</span>
				</span>
				<button type="button" class="kb-chat-close" id="kbChatClose" aria-label="<?php echo esc_attr( kb_t( '閉じる', 'Close' ) ); ?>">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
				</button>
			</header>
			<p class="kb-chat-note"><?php echo esc_html( kb_t( '本人に代わってAIが、サイト掲載情報をもとにお答えします。掲載のない内容にはお答えできません。', 'An AI answers on his behalf, based on the information published on this site. Questions beyond it cannot be answered.' ) ); ?></p>
			<div class="kb-chat-body" id="kbChatBody" aria-live="polite">
				<div class="kb-chat-msg model"><?php echo esc_html( kb_t( 'こんにちは、小林慎之助です！私の実績・経歴・お知らせなど、このサイトに載っていることなら何でも聞いてください。', "Hi, I'm Shinnosuke Kobayashi! Ask me anything about my work, career, or news published on this site." ) ); ?></div>
				<div class="kb-chat-suggests" id="kbChatSuggests">
					<?php foreach ( $suggests as $q ) : ?>
					<button type="button" class="kb-chat-suggest"><?php echo esc_html( $q ); ?></button>
					<?php endforeach; ?>
				</div>
			</div>
			<form class="kb-chat-form" id="kbChatForm">
				<input type="text" id="kbChatInput" maxlength="800" autocomplete="off" placeholder="<?php echo esc_attr( kb_t( '質問を入力…', 'Type a question…' ) ); ?>" aria-label="<?php echo esc_attr( kb_t( '質問', 'Question' ) ); ?>">
				<button type="submit" class="kb-chat-send" aria-label="<?php echo esc_attr( kb_t( '送信', 'Send' ) ); ?>">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
				</button>
			</form>
		</section>
	</div>
	<?php
}, 5 );

/* ---------- 管理画面（設定 → AIチャットボット） ---------- */
add_action( 'admin_menu', function () {
	add_options_page( 'AIチャットボット', 'AIチャットボット', 'manage_options', 'kb-chatbot', 'kb_chatbot_settings_page' );
} );

add_action( 'admin_init', function () {
	register_setting( 'kb_chatbot', 'kb_chatbot_settings', array(
		'type'              => 'array',
		'sanitize_callback' => function ( $in ) {
			$in = is_array( $in ) ? $in : array();
			return array(
				'enabled'  => empty( $in['enabled'] ) ? 0 : 1,
				'project'  => sanitize_text_field( isset( $in['project'] ) ? $in['project'] : '' ),
				'location' => sanitize_text_field( isset( $in['location'] ) ? $in['location'] : 'global' ),
				'model'    => sanitize_text_field( isset( $in['model'] ) ? $in['model'] : 'gemini-2.5-flash-lite' ),
				'api_key'  => sanitize_text_field( isset( $in['api_key'] ) ? $in['api_key'] : '' ),
			);
		},
	) );
} );

function kb_chatbot_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) { return; }
	$s = kb_chatbot_settings();

	/* 接続テスト（ボタン押下時のみVertex AIへ実リクエスト） */
	$test = null;
	if ( isset( $_GET['kb_chat_test'] ) && check_admin_referer( 'kb_chat_test' ) ) {
		$test = kb_chatbot_generate( 'これは接続テストです。「接続OK」とだけ返答してください。', array(), 'ja' );
	}
	?>
	<div class="wrap">
		<h1>AIチャットボット（Vertex AI）</h1>
		<p>サイト右下に表示するAIチャットボットの設定です。回答はプロフィール・実績などの掲載情報のみを根拠に生成されます（掲載外の内容には答えません）。<br>
		GCP側の準備（Vertex AI API有効化・VMサービスアカウントの権限）はリポジトリの「チャットボット導入手順.md」を参照してください。</p>
		<?php if ( null !== $test ) : ?>
			<?php if ( ! empty( $test['ok'] ) ) : ?>
			<div class="notice notice-success"><p><strong>接続テスト成功:</strong> <?php echo esc_html( $test['reply'] ); ?></p></div>
			<?php else : ?>
			<?php $kb_hints = array(
				'auth'  => 'アクセストークンを取得できません（メタデータサーバー不達）。GCE上で実行しているか確認してください。ローカル検証時はAPIキーを設定します。',
				'perm'  => 'Vertex AIに拒否されました（401/403）。導入手順の手順2（サービスアカウントへ roles/aiplatform.user 付与）と手順3（VMスコープを cloud-platform に変更）を確認してください。',
				'quota' => 'Vertex AI側のクォータ超過です。GCPコンソールの割り当てを確認するか、時間をおいて再試行してください。',
			); ?>
			<div class="notice notice-error"><p><strong>接続テスト失敗</strong>（コード: <?php echo esc_html( $test['code'] ); ?>）。
				<?php echo esc_html( isset( $kb_hints[ $test['code'] ] ) ? $kb_hints[ $test['code'] ]
					: 'Vertex AI APIの有効化・プロジェクトID・モデル名を確認してください。詳細はサーバーのPHPエラーログに出力されています。' ); ?></p></div>
			<?php endif; ?>
		<?php endif; ?>
		<form method="post" action="options.php">
			<?php settings_fields( 'kb_chatbot' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">チャットボットを表示</th>
					<td><label><input type="checkbox" name="kb_chatbot_settings[enabled]" value="1" <?php checked( $s['enabled'], 1 ); ?>> サイト右下にチャットウィジェットを表示する</label></td>
				</tr>
				<tr>
					<th scope="row"><label for="kb-project">GCPプロジェクトID</label></th>
					<td><input type="text" id="kb-project" class="regular-text" name="kb_chatbot_settings[project]" value="<?php echo esc_attr( $s['project'] ); ?>"></td>
				</tr>
				<tr>
					<th scope="row"><label for="kb-location">ロケーション</label></th>
					<td><input type="text" id="kb-location" class="regular-text" name="kb_chatbot_settings[location]" value="<?php echo esc_attr( $s['location'] ); ?>">
					<p class="description">通常は <code>global</code> のまま（最新モデルが全リージョン扱いで使える）。</p></td>
				</tr>
				<tr>
					<th scope="row"><label for="kb-model">モデル</label></th>
					<td><input type="text" id="kb-model" class="regular-text" name="kb_chatbot_settings[model]" value="<?php echo esc_attr( $s['model'] ); ?>">
					<p class="description">低コスト運用の既定値は <code>gemini-2.5-flash-lite</code>（入力$0.10/100万トークン・出力$0.40/100万トークン）。さらに安くするなら <code>gemini-2.0-flash-lite</code>。</p></td>
				</tr>
				<tr>
					<th scope="row"><label for="kb-api-key">APIキー（任意）</label></th>
					<td><input type="password" id="kb-api-key" class="regular-text" name="kb_chatbot_settings[api_key]" value="<?php echo esc_attr( $s['api_key'] ); ?>" autocomplete="new-password">
					<p class="description">空欄ならVM（GCE）のサービスアカウントで認証します（推奨）。ローカル検証やスコープ変更前の暫定運用時のみVertex AI APIキーを入力（APIキー使用時はグローバルエンドポイント固定となり、上のロケーション設定は無視されます）。</p></td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<p>
			<a href="<?php echo esc_url( wp_nonce_url( admin_url( 'options-general.php?page=kb-chatbot&kb_chat_test=1' ), 'kb_chat_test' ) ); ?>" class="button">接続テストを実行</a>
			<span class="description">（保存済みの設定でVertex AIへ1リクエスト送ります）</span>
		</p>
		<?php $kb_chat_pg = get_page_by_path( 'chat' ); if ( $kb_chat_pg ) : ?>
		<p class="description">全画面のAIチャットページ: <a href="<?php echo esc_url( get_permalink( $kb_chat_pg ) ); ?>" target="_blank"><?php echo esc_url( get_permalink( $kb_chat_pg ) ); ?></a>（有効化後に表示されます）</p>
		<?php endif; ?>
	</div>
	<?php
}

/* ---------- 全画面AIチャットページ（page-chat.php） ---------- */

/* 専用チャットページの判定（浮遊ウィジェット抑制・専用スクリプト読込に使用） */
function kb_is_chat_page() {
	return is_page_template( 'page-chat.php' ) || is_page( 'chat' );
}

/* アバター用の顔クロップ画像（テーマ同梱。本人写真を顔中心に正方クロップ済み）。
   FAB・ヘッダー・全画面ページで共通して本人の顔を確実に表示する */
function kb_avatar_face_url() {
	return get_template_directory_uri() . '/assets/img/kb-avatar-face.jpg?v=' . wp_get_theme()->get( 'Version' );
}

/* 「chat」固定ページを一度だけ自動生成し、page-chat.php テンプレートを割り当てる。
   /en/chat/ のルーティングは inc/i18n.php（パーマリンク再保存が必要） */
add_action( 'init', function () {
	if ( get_option( 'kb_chat_page_seeded' ) ) { return; }
	$page = get_page_by_path( 'chat' );
	if ( ! $page ) {
		$id = wp_insert_post( array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => 'AIチャット',
			'post_name'    => 'chat',
			'post_content' => '',
		) );
		if ( $id && ! is_wp_error( $id ) ) {
			update_post_meta( $id, '_wp_page_template', 'page-chat.php' );
		}
	} else {
		update_post_meta( $page->ID, '_wp_page_template', 'page-chat.php' );
	}
	update_option( 'kb_chat_page_seeded', 1 );
}, 20 );

/* 全画面ページの大きなアバター（ユーザー提供のLottie）。
   chat-page.js が lottie.min.js で idle/thinking/answering を読み込み、
   会話の状態に合わせて切り替える。Lottie読込前・JS無効時は静止ポスターを表示 */
function kb_chat_avatar_svg() {
	$alt    = esc_attr( kb_t( '小林慎之助', 'Shinnosuke Kobayashi' ) );
	$poster = esc_url( get_template_directory_uri() . '/assets/img/avatar-poster.png?v=' . wp_get_theme()->get( 'Version' ) );
	return '<div class="kbc-avatar" id="kbcAvatar" role="img" aria-label="' . $alt . '">'
		. '<img class="kbc-poster" src="' . $poster . '" alt="' . $alt . '" width="512" height="512">'
		. '</div>';
}
