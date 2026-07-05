<?php
/**
 * Kobayashi Portfolio — functions.php
 * サイト設計書 v1.1 §6-7 準拠
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/* ---------- ACFフィールドグループ（コード登録・導入手順§4） ---------- */
require_once get_template_directory() . '/inc/acf-fields.php';

/* ---------- SEO（description/OGPフォールバック＋JSON-LD） ---------- */
require_once get_template_directory() . '/inc/seo.php';

/* ---------- テーマ基本設定 ---------- */
add_action( 'after_setup_theme', function () {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
	register_nav_menus( array(
		'global' => 'グローバルナビ',
		'footer' => 'フッターナビ',
	) );
} );

/* ---------- アセット読み込み ---------- */
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style( 'kb-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans+JP:wght@400;500;700;900&display=swap', array(), null );
	wp_enqueue_style( 'kb-style', get_stylesheet_uri(), array( 'kb-fonts' ), wp_get_theme()->get( 'Version' ) );
	wp_enqueue_script( 'kb-main', get_template_directory_uri() . '/assets/main.js', array(), wp_get_theme()->get( 'Version' ), true );
} );

/* ---------- ファビコン（Shinnosuke.svg 由来の最適化PNG） ---------- */
add_action( 'wp_head', function () {
	$img = get_template_directory_uri() . '/assets/img';
	echo '<link rel="icon" type="image/png" sizes="32x32" href="' . esc_url( $img . '/favicon-32.png' ) . '">' . "\n";
	echo '<link rel="icon" type="image/png" sizes="192x192" href="' . esc_url( $img . '/favicon-192.png' ) . '">' . "\n";
	echo '<link rel="apple-touch-icon" href="' . esc_url( $img . '/apple-touch-icon.png' ) . '">' . "\n";
}, 5 );

/* ---------- カスタム投稿タイプ（設計書 §6.1） ---------- */
add_action( 'init', function () {

	/* ---------- タクソノミー（設計書 §6.2）
	   works_type のスラッグ（works/type）が CPT works のリライトルールに
	   先取りされないよう、タクソノミーを CPT より先に登録する ---------- */
	register_taxonomy( 'works_type', 'works', array(
		'labels'       => array( 'name' => '実績種別' ),
		'hierarchical' => true,
		'rewrite'      => array( 'slug' => 'works/type' ),
		'show_in_rest' => true,
	) );

	register_taxonomy( 'skill', array( 'works', 'column', 'news' ), array(
		'labels'       => array( 'name' => 'スキルタグ' ),
		'hierarchical' => false,
		'rewrite'      => array( 'slug' => 'skill' ),
		'show_in_rest' => true,
	) );

	register_taxonomy( 'industry', 'works', array(
		'labels'       => array( 'name' => '業界' ),
		'hierarchical' => false,
		'rewrite'      => array( 'slug' => 'industry' ),
		'show_in_rest' => true,
	) );

	/* お知らせの種別（記事ごとに管理画面から選択→一覧でバッジ表示）。
	   works_type と同じく news/type スラッグをCPTより先に登録する */
	register_taxonomy( 'news_type', 'news', array(
		'labels'       => array( 'name' => 'お知らせ種別', 'singular_name' => 'お知らせ種別', 'add_new_item' => '種別を追加' ),
		'hierarchical' => true,
		'rewrite'      => array( 'slug' => 'news/type' ),
		'show_in_rest' => true,
	) );
	/* 種別の初期値を一度だけ投入（以後は管理画面から自由に追加・変更可） */
	if ( ! get_option( 'kb_news_types_seeded' ) ) {
		foreach ( array( 'お知らせ', '登壇・イベント', 'メディア掲載', 'リリース' ) as $t ) {
			if ( ! term_exists( $t, 'news_type' ) ) { wp_insert_term( $t, 'news_type' ); }
		}
		update_option( 'kb_news_types_seeded', 1 );
	}

	register_post_type( 'works', array(
		'labels'       => array( 'name' => '実績', 'singular_name' => '実績', 'add_new_item' => '実績を追加' ),
		'public'       => true,
		'has_archive'  => true,
		'menu_position'=> 5,
		'menu_icon'    => 'dashicons-portfolio',
		'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields' ),
		'rewrite'      => array( 'slug' => 'works' ),
		'show_in_rest' => true,
	) );

	register_post_type( 'column', array(
		'labels'       => array( 'name' => 'コラム', 'singular_name' => 'コラム', 'add_new_item' => 'コラムを追加' ),
		'public'       => true,
		'has_archive'  => true,
		'menu_position'=> 6,
		'menu_icon'    => 'dashicons-edit-page',
		'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields' ),
		'rewrite'      => array( 'slug' => 'column' ),
		'show_in_rest' => true,
	) );

	register_post_type( 'news', array(
		'labels'       => array( 'name' => 'お知らせ', 'singular_name' => 'お知らせ', 'add_new_item' => 'お知らせを追加' ),
		'public'       => true,
		'has_archive'  => true,
		'menu_position'=> 7,
		'menu_icon'    => 'dashicons-megaphone',
		'supports'     => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
		'rewrite'      => array( 'slug' => 'news' ),
		'show_in_rest' => true,
	) );

	register_post_type( 'document', array(
		'labels'              => array( 'name' => 'DL資料', 'singular_name' => 'DL資料', 'add_new_item' => '資料を追加' ),
		'public'              => false,
		'show_ui'             => true,
		'menu_position'       => 8,
		'menu_icon'           => 'dashicons-media-document',
		'supports'            => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
		'exclude_from_search' => true,
	) );

} );

/* ---------- メインクエリ調整（F-01 検索横断・件数） ---------- */
add_action( 'pre_get_posts', function ( $q ) {
	if ( is_admin() || ! $q->is_main_query() ) { return; }

	if ( $q->is_search() ) {
		$q->set( 'post_type', array( 'works', 'column', 'news' ) );
	}
	if ( $q->is_post_type_archive( 'works' ) || $q->is_tax( 'works_type' ) ) {
		$q->set( 'posts_per_page', 12 );
	}
	if ( $q->is_post_type_archive( 'column' ) ) {
		$q->set( 'posts_per_page', 10 );
	}
	if ( $q->is_post_type_archive( 'news' ) ) {
		$q->set( 'posts_per_page', 15 );
	}
} );

/* ---------- PVカウント＋ランキング（F-03） ---------- */
function kb_track_views() {
	if ( is_singular( array( 'works', 'column' ) ) && ! is_user_logged_in() ) {
		$id = get_the_ID();
		update_post_meta( $id, 'kb_views', (int) get_post_meta( $id, 'kb_views', true ) + 1 );
	}
}
add_action( 'wp_head', 'kb_track_views' );

function kb_ranking( $n = 5 ) {
	return new WP_Query( array(
		'post_type'      => array( 'works', 'column' ),
		'posts_per_page' => $n,
		'meta_key'       => 'kb_views',
		'orderby'        => 'meta_value_num',
		'order'          => 'DESC',
		'no_found_rows'  => true,
	) );
}

/* ---------- ACF互換フィールド取得（ACF未導入でも動作） ---------- */
function kb_field( $key, $id = null ) {
	$id = $id ? $id : get_the_ID();
	if ( function_exists( 'get_field' ) ) {
		return get_field( $key, $id );
	}
	return get_post_meta( $id, $key, true );
}

/* ---------- プロフィール編集フィールド ----------
   固定ページ「プロフィール」の入力欄（inc/acf-fields.php で登録）から
   取得し、未入力の項目は下記の初期値で表示する。編集画面にも同じ
   初期値がプリセットされるため、保存前後で見た目は変わらない */
function kb_profile_defaults() {
	return array(
		'profile_kana' => 'こばやし しんのすけ',
		'profile_name' => '小林 慎之助',
		'profile_role' => 'Weeave株式会社 共同創業者・代表取締役 CEO ／ 筑波大学 理工学群 社会工学類 経営工学主専攻',
		'profile_bio'  => '筑波大学で経営工学を学びながら、政治・行政・企業のDXと社会課題の解決に取り組む学生起業家。データドリブンな戦略立案と、人と人をつなぐコミュニティ構築を強みに、「構想で終わらせず、現場で使われる仕組みとして社会に実装する」ことに一貫してこだわっています。長期的には「日本の技術を社会に届けるコーディネーター」として、ディープテックの社会実装をビジネス・資本構造の側から支えることを目指しています。',
		'profile_career' => implode( "\n", array(
			'2025.09 – | Weeave株式会社 共同創業・代表取締役 CEO | 政治・行政・企業のDXを推進する筑波大学認定スタートアップを共同創業。政治DX・広報戦略支援、地域ニーズの可視化、システム開発・社会実装の3本柱で事業を展開。',
			'2025.01 – 2025.12 | JSIP（Japan Southeast Asia Innovation Platform）Community Accelerator | シンガポール拠点で日本企業の東南アジア進出を支援。約3ヶ月で100名近い新規事業担当者と接点を構築。',
			'2025.04 – 2025.09 | 衆議院議員事務所 Digital Transformation Manager | 政治・立法活動のDXを担当。独自の選挙シミュレーションモデルを開発し、データドリブンな戦略立案を支援。',
			'2024.11 – 2025.06 | RULEMAKERS DAO Team Manager | 「RIFT」ブランド確立のためのマルチチャネル・マーケティング戦略を立案・実行。',
			'2024.04 – 2025.03 | AIESEC Business Development Manager | 渉外統括として企業パートナーとの関係構築、ディープテック×学生のイベント企画を推進。',
			'2024.01 – 2024.12 | 株式会社Geears Growth Marketing Intern | 大学1年次に直談判で参画。政治ブランディング等の戦略立案を主導し、のちのWeeave共同創業の起点に。',
			'2023.04 – | 筑波大学 理工学群 社会工学類 入学（経営工学主専攻） | 2027年3月卒業見込み。2027年4月より同大学院サービス工学学位プログラムに進学予定（有馬澄佳研究室）。',
		) ),
		'profile_skills' => implode( "\n", array(
			'事業開発・DX | 事業開発・新規事業創出、DX推進（政治・行政・企業）、クロスボーダー事業開発',
			'データ・分析 | データ分析、選挙シミュレーション、経営工学／OR',
			'マーケティング・コミュニティ | マーケティング・広報、ブランディング、コミュニティ構築、イベント企画',
			'言語 | 日本語（母語）、英語（ビジネスレベル）',
		) ),
		'profile_research_title' => '下水サーベイランスを起点とした医薬品サプライチェーンの予兆・予動最適化システム',
		'profile_research_body'  => '下水サーベイランス（WBE）による感染流行の先行予測を医薬品サプライチェーンの在庫・物流の意思決定へ統合し、「事後対応」から「予兆・予動管理」への転換を目指す研究。有馬澄佳研究室にて、オペレーションズ・リサーチと公衆衛生データを架橋する社会実装志向のテーマに取り組んでいます。',
		'profile_activities' => implode( "\n", array(
			'静岡県議会議員向け AI勉強会（主催・講師）— 政治現場での生成AI活用を講義',
			'「戦略的大学生活のススメ vol.49」ピッチ登壇（2025.04／Tsukuba Place Lab）',
			'JSIP公式メディア インターン体験インタビュー掲載',
		) ),
	);
}
function kb_profile_field( $key ) {
	static $page_id = null;
	if ( $page_id === null ) {
		$p = get_page_by_path( 'profile' );
		$page_id = $p ? $p->ID : 0;
	}
	$v = $page_id ? kb_field( $key, $page_id ) : '';
	if ( is_string( $v ) && trim( $v ) !== '' ) {
		return trim( $v );
	}
	$d = kb_profile_defaults();
	return isset( $d[ $key ] ) ? $d[ $key ] : '';
}
/* 「1行1項目」形式のフィールドを行配列で返す */
function kb_profile_lines( $key ) {
	return array_values( array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', kb_profile_field( $key ) ) ), 'strlen' ) );
}

/* ---------- 公開日・更新日の2軸表示（設計書 §6.4） ---------- */
function kb_dates() {
	$pub = get_the_date( 'Y.m.d' );
	$mod = get_the_modified_date( 'Y.m.d' );
	if ( $mod && $mod !== $pub ) {
		echo '<span>更新日 ' . esc_html( $mod ) . '</span><span>公開日 ' . esc_html( $pub ) . '</span>';
	} else {
		echo '<span>公開日 ' . esc_html( $pub ) . '</span>';
	}
}

/* ---------- パンくず（F-06） ---------- */
function kb_breadcrumbs() {
	if ( is_front_page() ) { return; }
	echo '<nav class="breadcrumbs" aria-label="パンくず"><a href="' . esc_url( home_url( '/' ) ) . '">top</a>';
	$sep = '<span class="sep">›</span>';

	if ( is_singular( array( 'works', 'column', 'news' ) ) ) {
		$pt  = get_post_type_object( get_post_type() );
		echo $sep . '<a href="' . esc_url( get_post_type_archive_link( get_post_type() ) ) . '">' . esc_html( $pt->labels->name ) . '</a>';
		echo $sep . '<span>' . esc_html( get_the_title() ) . '</span>';
	} elseif ( is_post_type_archive() ) {
		echo $sep . '<span>' . esc_html( post_type_archive_title( '', false ) ) . '</span>';
	} elseif ( is_tax( 'works_type' ) ) {
		echo $sep . '<a href="' . esc_url( get_post_type_archive_link( 'works' ) ) . '">実績</a>';
		echo $sep . '<span>' . esc_html( single_term_title( '', false ) ) . '</span>';
	} elseif ( is_tax() || is_tag() || is_category() ) {
		echo $sep . '<span>' . esc_html( single_term_title( '', false ) ) . '</span>';
	} elseif ( is_page() ) {
		echo $sep . '<span>' . esc_html( get_the_title() ) . '</span>';
	} elseif ( is_search() ) {
		echo $sep . '<span>検索結果</span>';
	}
	echo '</nav>';
}

/* ---------- サムネイル（画像未設定時はグラデーション代替） ---------- */
function kb_thumb( $class = 'thumb' ) {
	$id    = get_the_ID();
	$grad  = 'g' . ( ( $id % 6 ) + 1 );
	$types = get_the_terms( $id, 'works_type' );
	$label = ( $types && ! is_wp_error( $types ) ) ? $types[0]->name : strtoupper( get_post_type() );
	echo '<div class="' . esc_attr( $class . ' ' . $grad ) . '">';
	if ( has_post_thumbnail() ) {
		the_post_thumbnail( 'medium_large' );
	}
	echo '<span class="ph-label">' . esc_html( $label ) . '</span></div>';
}

/* ---------- プロフィール写真アバター ----------
   profileページのアイキャッチを全箇所で流用（未設定時はイニシャル代替） */
function kb_avatar() {
	$profile = get_page_by_path( 'profile' );
	echo '<div class="avatar">';
	if ( $profile && has_post_thumbnail( $profile->ID ) ) {
		echo get_the_post_thumbnail( $profile->ID, 'medium', array( 'alt' => get_bloginfo( 'name' ) ) );
	} else {
		echo '<span class="init">SK</span>';
	}
	echo '</div>';
}

/* ---------- SNSリンク ----------
   URLを空にするとそのアカウントは非表示になる（Instagramは
   アカウントURL確定後にここへ記入するだけで表示される） */
function kb_sns_accounts() {
	return array(
		'linkedin'  => array( 'label' => 'LinkedIn', 'url' => 'https://www.linkedin.com/in/shinnosuke-kobayashi/' ),
		'facebook'  => array( 'label' => 'Facebook', 'url' => 'https://www.facebook.com/shinnon21' ),
		'instagram' => array( 'label' => 'Instagram', 'url' => 'https://www.instagram.com/shinnon21/' ),
		'note'      => array( 'label' => 'note', 'url' => 'https://note.com/shinnon21/' ),
	);
}
function kb_sns_links( $style = 'pill' ) {
	/* 各SNSの公式ロゴ・公式ブランドカラー（LinkedIn #0A66C2 / Facebook #0866FF /
	   Instagramは公式グラデーション）。形状はブランドガイド配布のロゴパスに準拠。
	   $style: 'pill'=ラベル付きピル（モバイルメニュー等） / 'icons'=アイコンのみの
	   円形チップ（フッター） / 'tiles'=上ロゴ・下媒体名の縦型タイル（プロフィール） */
	if ( true === $style ) { $style = 'icons'; }
	$icons_only = ( 'icons' === $style );
	$icons = array(
		'linkedin'  => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>',
		'facebook'  => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0866FF" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
		'instagram' => '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="kbIgGrad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FFDD55"/><stop offset=".25" stop-color="#FA7E1E"/><stop offset=".5" stop-color="#D62976"/><stop offset=".75" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><path fill="url(#kbIgGrad)" d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793 0 1.44.645 1.44 1.439z"/></svg>',
		'note'      => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#000000" d="M0 .279c4.623 0 10.953-.235 15.498-.117 6.099.156 8.39 2.813 8.468 9.374.077 3.71 0 14.335 0 14.335h-6.598c0-9.296.04-10.83 0-13.759-.078-2.578-.814-3.807-2.795-4.041-2.097-.235-7.975-.04-7.975-.04v17.84H0Z"/></svg>',
	);
	/* 同一ページに複数回出力してもSVGグラデーションのidが衝突しないよう連番化 */
	static $uid = 0;
	$uid++;
	$icons['instagram'] = str_replace( 'kbIgGrad', 'kbIgGrad' . $uid, $icons['instagram'] );

	$out = '';
	foreach ( kb_sns_accounts() as $key => $a ) {
		if ( empty( $a['url'] ) ) { continue; }
		$out .= '<a class="sns-btn" href="' . esc_url( $a['url'] ) . '" target="_blank" rel="noopener"'
			. ( $icons_only ? ' aria-label="' . esc_attr( $a['label'] ) . '"' : '' ) . '>'
			. $icons[ $key ]
			. ( $icons_only ? '' : '<span>' . esc_html( $a['label'] ) . '</span>' )
			. '</a>';
	}
	if ( $out ) {
		$cls = array( 'pill' => '', 'icons' => ' sns-icons', 'tiles' => ' sns-tiles' );
		echo '<div class="sns-row' . ( isset( $cls[ $style ] ) ? $cls[ $style ] : '' ) . '">' . $out . '</div>';
	}
}

/* ---------- 実績種別バッジ ---------- */
function kb_type_badge() {
	$types = get_the_terms( get_the_ID(), 'works_type' );
	if ( $types && ! is_wp_error( $types ) ) {
		echo '<span class="badge accent">' . esc_html( $types[0]->name ) . '</span>';
	}
}

/* ---------- お知らせ種別バッジ（未選択なら何も出さない） ---------- */
function kb_news_type_badge() {
	$types = get_the_terms( get_the_ID(), 'news_type' );
	if ( $types && ! is_wp_error( $types ) ) {
		echo '<span class="badge">' . esc_html( $types[0]->name ) . '</span>';
	}
}

/* ---------- スキルタグチップ ----------
   カード全体が <a> のコンテキストでは $linked = false を指定すること。
   <a> の入れ子はHTMLパーサーが外側のリンクを分割し、カードの
   .thumb / .body がグリッドの別セルに割れてレイアウトが崩壊する */
function kb_skill_chips( $limit = 3, $linked = true ) {
	$terms = get_the_terms( get_the_ID(), 'skill' );
	if ( ! $terms || is_wp_error( $terms ) ) { return; }
	echo '<div class="tags">';
	foreach ( array_slice( $terms, 0, $limit ) as $t ) {
		if ( $linked ) {
			echo '<a class="chip" href="' . esc_url( get_term_link( $t ) ) . '"># ' . esc_html( $t->name ) . '</a>';
		} else {
			echo '<span class="chip"># ' . esc_html( $t->name ) . '</span>';
		}
	}
	echo '</div>';
}

/* ---------- 実績期間表示 ---------- */
function kb_works_period() {
	$s = kb_field( 'period_start' );
	$e = kb_field( 'period_end' );
	if ( $s ) {
		echo '<span>' . esc_html( $s ) . ' – ' . esc_html( $e ? $e : '現在' ) . '</span>';
	}
}

/* ---------- ページネーション ---------- */
function kb_pagination( $query = null ) {
	global $wp_query;
	$q = $query ? $query : $wp_query;
	$links = paginate_links( array(
		'total'     => $q->max_num_pages,
		'current'   => max( 1, get_query_var( 'paged' ) ),
		'mid_size'  => 1,
		'prev_text' => '‹',
		'next_text' => '›',
		'type'      => 'plain',
	) );
	if ( $links ) {
		echo '<div class="pagination"><div class="nav-links">' . $links . '</div></div>';
	}
}

/* ---------- 抜粋 ---------- */
add_filter( 'excerpt_length', function () { return 60; } );
add_filter( 'excerpt_more', function () { return '…'; } );

/* ---------- デフォルトナビ（メニュー未設定時のフォールバック） ---------- */
function kb_default_nav() {
	$items = array(
		array( '実績', 'works', get_post_type_archive_link( 'works' ) ),
		array( 'コラム', 'column', get_post_type_archive_link( 'column' ) ),
		array( 'お知らせ', 'news', get_post_type_archive_link( 'news' ) ),
		array( 'プロフィール', 'profile', home_url( '/profile/' ) ),
		array( 'About', 'about', home_url( '/about/' ) ),
	);
	echo '<ul>';
	foreach ( $items as $i ) {
		echo '<li><a href="' . esc_url( $i[2] ) . '">' . esc_html( $i[0] ) . '<small>' . esc_html( $i[1] ) . '</small></a></li>';
	}
	echo '</ul>';
}

/* ---------- 標準「投稿」を管理画面から非表示（CPTに集約） ---------- */
add_action( 'admin_menu', function () {
	remove_menu_page( 'edit.php' );
} );
