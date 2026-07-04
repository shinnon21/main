<?php
/**
 * 本番初期コンテンツ投入（wp eval-file deploy/seed-content.php で実行）
 * ローカル（wp-now）で検証済みのシードと同一内容:
 * 一般設定・固定ページ・タクソノミー・実績7件・CF7フォーム・顔写真
 */

if ( ! class_exists( 'WP_CLI' ) ) {
	/* wp-cli外（ローカル検証等）でも実行できるようにするシム */
	class WP_CLI {
		public static function log( $m ) { echo $m . "\n"; }
		public static function success( $m ) { echo '✅ ' . $m . "\n"; }
	}
}

if ( get_option( 'kb_seeded' ) ) {
	WP_CLI::log( 'already seeded — skip' );
	return;
}

/* テーマ未有効のまま実行するとタクソノミー割当が消失するため中断 */
if ( ! taxonomy_exists( 'works_type' ) || ! post_type_exists( 'works' ) ) {
	WP_CLI::log( 'ERROR: kobayashi-theme が有効化されていません。wp theme activate kobayashi-theme を先に実行してください。' );
	return;
}

/* ---------- 1. 一般設定 ---------- */
update_option( 'blogname', '小林慎之助 公式ホームページ' );
update_option( 'blogdescription', '政治・行政のDXから医薬品サプライチェーン研究まで。日本の技術を社会に届けるコーディネーターを志す、小林慎之助のポートフォリオサイトです。' );
update_option( 'timezone_string', 'Asia/Tokyo' );
update_option( 'permalink_structure', '/%postname%/' );
delete_option( 'rewrite_rules' ); // 次回リクエストで再生成（wp-cli外での実行時のフォールバック。本番はさらに wp rewrite flush --hard を実行）

/* ---------- 2. 固定ページ（documentsはDL資料廃止のため作成しない） ---------- */
$pages = array(
	array( 'プロフィール', 'profile' ),
	array( '条件から探す', 'searches' ),
	array( 'このサイトについて', 'about' ),
	array( 'お問い合わせ', 'contact' ),
	array( 'プライバシーポリシー', 'privacy' ),
);
foreach ( $pages as $p ) {
	if ( ! get_page_by_path( $p[1] ) ) {
		wp_insert_post( array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => $p[0],
			'post_name'    => $p[1],
			'post_content' => '',
		) );
	}
}

/* ---------- 3. タクソノミー用語 ---------- */
foreach ( array( '起業・経営', 'DX支援', '国際事業開発', 'マーケティング', '登壇・講師' ) as $t ) { wp_insert_term( $t, 'works_type' ); }
foreach ( array( '政治DX', 'データ分析', '事業開発', '東南アジア', 'コミュニティ構築', '経営工学', 'サプライチェーン', '生成AI活用', 'マーケティング', 'スタートアップ' ) as $t ) { wp_insert_term( $t, 'skill' ); }
wp_insert_term( '政治・行政', 'industry' );

/* ---------- 4. 実績7件（小林慎之助_ポートフォリオ.md 準拠） ---------- */
$works = array(
	array(
		'title'   => 'Weeave株式会社 共同創業・経営',
		'type'    => '起業・経営',
		'skills'  => array( 'スタートアップ', '政治DX', '事業開発', '生成AI活用' ),
		'industry'=> array( '政治・行政' ),
		'meta'    => array(
			'client_name'  => 'Weeave株式会社（自社）',
			'period_start' => '2025.09',
			'period_end'   => '',
			'role'         => '共同創業者・代表取締役 CEO',
			'scope'        => array( '要件定義', '設計', '実装', '運用' ),
			'tech_stack'   => 'SNS運用・AI対話システム・データ分析基盤',
			'site_url'     => 'https://www.weeave.co.jp/',
			'is_featured'  => '1',
		),
		'excerpt' => '「Weave the Design of Society.」を掲げる筑波大学認定スタートアップを共同創業。政治DX・広報戦略支援、地域ニーズの可視化、システム開発・社会実装の3本柱で事業を展開。',
		'content' => '
<h2>概要</h2>
<p>社会変革とデジタルイノベーションを推進する筑波大学認定スタートアップ、Weeave株式会社を2025年9月に共同創業し、代表取締役CEOに就任。テクノロジーの力で複雑な社会課題を解決し、行政・政治プロセスを現代化することをミッションに掲げています。スローガンは <strong>"Weave the Design of Society."</strong>、ビジョンは「分断された社会をつなぎ、誰一人取り残さない社会設計へ（Be Inclusive）」。</p>
<h2>創業の経緯</h2>
<p>大学1年次の2024年1月、HPから直接問い合わせて株式会社ギアーズのインターンに参画し、政治家のブランディング・マーケティングに従事したことが起点。2025年4月からは議員事務所・政治のDXへと領域を広げ、同年9月、ギアーズ代表取締役であり東北大学 言語AIセンター 特任教授（客員）でもある細貝征弘氏とともに共同創業しました（細貝氏は取締役）。インターンから始まった政治・行政DXの実務経験が、そのまま起業へと結実したかたちです。</p>
<h2>事業の3本柱</h2>
<ol>
<li><strong>政治DX・広報戦略支援</strong> — SNSとAI対話システムを活用し、一方通行の発信から双方向のコミュニケーションへ。住民の声を蓄積・可視化し、持続可能な事務所運営の体制づくりまでを支援。</li>
<li><strong>地域ニーズの可視化</strong> — 地域の「声なき声」や統計データを収集・分析し、客観的な数値として可視化。根拠ある政策検討を支援。</li>
<li><strong>システム開発・社会実装</strong> — 構想にとどまらず、システムの構築から運用までを一貫して担い、地域に根づく仕組みとして実装。</li>
</ol>
<h2>導入事例</h2>
<p>株式会社ギアーズ（データ分析）、一般社団法人RULEMAKERS DAO（広報）。</p>',
	),
	array(
		'title'   => '衆議院議員事務所のDX支援・選挙シミュレーションモデル開発',
		'type'    => 'DX支援',
		'skills'  => array( '政治DX', 'データ分析', '生成AI活用' ),
		'industry'=> array( '政治・行政' ),
		'meta'    => array(
			'client_name'  => '衆議院議員事務所（愛知県選出）',
			'period_start' => '2025.04',
			'period_end'   => '2025.09',
			'role'         => 'Digital Transformation Manager',
			'scope'        => array( '要件定義', '設計', '実装', '運用' ),
			'tech_stack'   => '選挙シミュレーションモデル（自作）・SNS・オンラインイベント基盤',
			'is_featured'  => '1',
		),
		'excerpt' => '愛知県選出の衆議院議員事務所にて、政治・立法活動のデジタル現代化を担当。独自の選挙シミュレーションモデルを開発し、データドリブンな戦略立案を支援。',
		'content' => '
<h2>概要</h2>
<p>愛知県選出の衆議院議員事務所にて、政治・立法活動のデジタル現代化を担当しました。</p>
<h2>主な取り組み</h2>
<ul>
<li>政治活動・選挙戦略を現代化するためのDXイニシアチブを主導。</li>
<li>データドリブンな戦略立案と意思決定を可能にする、独自の<strong>選挙シミュレーションモデル</strong>を開発。</li>
<li>SNSキャンペーンやオンラインイベントを含むデジタル・エンゲージメント戦略を立案・実行し、有権者へのアウトリーチを強化。</li>
<li>事務処理やワークフローのデジタル化により、内部オペレーションの効率を向上。</li>
</ul>
<h2>成果・その後</h2>
<p>この経験で得た政治・行政DXの知見と実績が、2025年9月のWeeave株式会社共同創業へと直接つながりました。</p>',
	),
	array(
		'title'   => 'JSIP — 日本企業の東南アジア新規事業開発支援',
		'type'    => '国際事業開発',
		'skills'  => array( '東南アジア', '事業開発', 'コミュニティ構築', 'マーケティング' ),
		'industry'=> array(),
		'meta'    => array(
			'client_name'  => 'Japan Southeast Asia Innovation Platform（JSIP）',
			'period_start' => '2025.01',
			'period_end'   => '2025.12',
			'role'         => 'Community Accelerator',
			'scope'        => array( '運用' ),
			'tech_stack'   => 'PRコンテンツ制作・イベント運営・コミュニティマネジメント',
			'site_url'     => 'https://jsip.asia/',
			'is_featured'  => '1',
			'kpi_results'  => array(
				array( 'label' => '新規事業担当者との接点構築（約3ヶ月）', 'value' => '約100名' ),
			),
		),
		'excerpt' => 'シンガポール拠点の共創プラットフォームJSIPにて、日本企業の東南アジア市場参入を支援。約3ヶ月で100名近い新規事業担当者と接点を構築。',
		'content' => '
<h2>概要</h2>
<p>JSIPは、日本企業の東南アジアにおける新規事業開発を支援する戦略的な共創プラットフォーム。2024年11月のつくば市とのMOU締結のニュースリリースを目にし、「シンガポールでやってみたい」と直談判で応募して参画しました。2025年1〜3月はシンガポールに滞在し、帰国後も東京から継続して活動しました。</p>
<h2>主な取り組み</h2>
<ul>
<li>日本企業の東南アジア市場参入を支援するため、コミュニティ・エンゲージメントとパートナーシップ開発を主導。</li>
<li>企業ニーズの発掘と、現地企業・政府機関との戦略的アライアンス構築を通じて、新規事業創出を推進。</li>
<li><strong>PR業務</strong> — イベント告知文の作成、開催レポート、アントレプレナー会員向け紹介動画の制作。</li>
<li><strong>会員企業とのミーティングサポート</strong> — オンボーディングやキャッチアップに同席し、リアルな事業課題と期待をヒアリング。</li>
<li>「JSIP Lounge」などのイベント運営に参画。</li>
</ul>
<h2>成果・学び</h2>
<p>約3ヶ月で100名近い新規事業担当者と接点を構築。マリーナ・ベイ・サンズで開催された「InnoVision」（参加者300名以上）への参加などを通じて、「ビジネスは人と人との間にある」という原体験を得ました。この経験が「日本の技術を社会に届けるコーディネーター」という長期的アイデンティティの結晶化につながっています。</p>
<p>関連リンク: <a href="https://note.com/shinnon21/n/ne4e1b865eeee" target="_blank" rel="noopener">シンガポールでの体験記（note）</a>／<a href="https://jsip.asia/news/jsip_intern_kobayashi/" target="_blank" rel="noopener">インターンインタビュー</a></p>',
	),
	array(
		'title'   => 'RULEMAKERS DAO —「RIFT」ブランドのマーケティング戦略',
		'type'    => 'マーケティング',
		'skills'  => array( 'マーケティング', 'コミュニティ構築', 'データ分析' ),
		'industry'=> array(),
		'meta'    => array(
			'client_name'  => '一般社団法人RULEMAKERS DAO',
			'period_start' => '2024.11',
			'period_end'   => '2025.06',
			'role'         => 'Team Manager',
			'scope'        => array( '要件定義', '設計', '運用' ),
			'tech_stack'   => 'マルチチャネル・マーケティング／コンテンツ制作',
			'site_url'     => 'https://rulemakers.io/rift',
		),
		'excerpt' => '協働的なルールメイキングで社会課題に取り組む組織にて、「RIFT」ブランド確立のためのマルチチャネル・マーケティング戦略を立案・実行。',
		'content' => '
<h2>概要</h2>
<p>RULEMAKERS DAOは、協働的なルールメイキングを通じて社会課題の解決に取り組む先進的な組織。Team Managerとしてプログラム「RIFT」のマーケティングを担当しました。</p>
<h2>主な取り組み</h2>
<ul>
<li>グローバルなイノベーターコミュニティ内で「RIFT」ブランドを確立するため、マルチチャネルのマーケティング戦略を立案・実行。</li>
<li>RIFTの独自の価値提案を効果的に伝え、プログラム参加者（イノベーター）と戦略的パートナーのリクルーティングを推進。</li>
<li>データに基づく知見を活用してアウトリーチ施策を最適化し、インパクトの大きいルールメイカーをターゲティング・獲得。</li>
<li>新しい市場・社会システムを設計するというプログラムのミッションを、説得力あるメッセージとコンテンツで言語化。</li>
</ul>',
	),
	array(
		'title'   => 'AIESEC — 渉外統括・ディープテック×学生イベントの企画',
		'type'    => '国際事業開発',
		'skills'  => array( 'コミュニティ構築', '事業開発' ),
		'industry'=> array(),
		'meta'    => array(
			'client_name'  => 'AIESEC（茨城・つくば）',
			'period_start' => '2024.04',
			'period_end'   => '2025.03',
			'role'         => 'Business Development Manager',
			'scope'        => array( '要件定義', '運用' ),
			'tech_stack'   => 'スポンサー渉外・イベント企画・チームマネジメント',
			'site_url'     => 'https://www.aiesec.jp/',
		),
		'excerpt' => '世界最大級の学生主体組織AIESECで渉外活動を統括。学生をディープテック産業に触れさせる戦略的イベントを企画し、スポンサー獲得目標の達成を牽引。',
		'content' => '
<h2>概要</h2>
<p>AIESECは、異文化交流を通じてリーダーシップ開発の機会を提供する、世界最大級の学生主体の組織。Business Development Managerとして渉外を統括しました。</p>
<h2>主な取り組み</h2>
<ul>
<li>渉外活動を統括し、企業パートナーやステークホルダーとの関係構築・維持を担当。</li>
<li>学生をディープテック産業に触れさせ、リーダーシップ開発を促す戦略的イベントを企画・設計。</li>
<li>部門横断のプロジェクトチームを率い、スポンサー獲得目標の達成と、インパクトの大きいイベントのフレームワーク構築を推進。</li>
</ul>',
	),
	array(
		'title'   => '株式会社Geears — グロースマーケティング・戦略立案',
		'type'    => 'マーケティング',
		'skills'  => array( 'マーケティング', 'データ分析', '政治DX' ),
		'industry'=> array( '政治・行政' ),
		'meta'    => array(
			'client_name'  => '株式会社Geears',
			'period_start' => '2024.01',
			'period_end'   => '2024.12',
			'role'         => 'Growth Marketing Intern',
			'scope'        => array( '設計', '運用' ),
			'tech_stack'   => 'データ分析・マーケティング戦略立案',
			'site_url'     => 'https://geears.co.jp/',
		),
		'excerpt' => '大学1年次に直談判で参画したデータドリブン・コンサルティングファーム。政治ブランディング等の戦略立案を主導し、のちのWeeave共同創業の起点に。',
		'content' => '
<h2>概要</h2>
<p>Geearsは、データドリブンなマーケティングと事業戦略ソリューションを専門とする日本のコンサルティングファーム（代表取締役：細貝征弘氏）。大学1年次の2024年1月、自らHPから問い合わせて（直談判で）インターンに参画したことが、その後のキャリアと起業（Weeave設立）の起点となりました。</p>
<h2>主な取り組み</h2>
<ul>
<li>政治ブランディング、エネルギー業界の人材育成プログラム、環境NPO支援など、多様なプロジェクトで戦略立案を主導。</li>
<li>データ分析を活用して高パフォーマンスのマーケティング戦略を構築・最適化し、継続的な改善を推進。</li>
<li>政治・経済・環境分野での経験を活かし、独自性のある革新的なクライアントソリューションを提供。</li>
</ul>',
	),
	array(
		'title'   => '静岡県議会議員向け AI勉強会（主催・講師）',
		'type'    => '登壇・講師',
		'skills'  => array( '生成AI活用', '政治DX' ),
		'industry'=> array( '政治・行政' ),
		'meta'    => array(
			'client_name'  => '静岡県議会議員',
			'period_start' => '',
			'period_end'   => '',
			'role'         => '主催・講師（Weeave株式会社 代表として）',
			'scope'        => array( '要件定義', '運用' ),
			'tech_stack'   => '生成AI・デジタルツール活用研修',
		),
		'excerpt' => 'Weeave株式会社代表として、静岡県議会議員向けにAI活用の勉強会を主催・講師を担当。政治・行政の現場における生成AIの実践的な活用方法を共有。',
		'content' => '
<h2>概要</h2>
<p>Weeave株式会社 代表として、静岡県議会議員に向けたAI活用の勉強会を実施。政治・行政の現場における生成AI・デジタルツールの実践的な活用方法を共有し、政治DXの普及・啓発に取り組みました。</p>
<h2>関連する登壇・対外活動</h2>
<ul>
<li>「戦略的大学生活のススメ vol.49」ピッチ登壇（2025年4月17日／Tsukuba Place Lab・主催：株式会社しびっくぱわー）— シンガポール・JSIPでの事業開発支援や議員事務所DXの経験をもとに「戦略的に大学生活を送るためのTips」を発表。</li>
<li>JSIP公式メディアにてインターン体験インタビューが記事として公開。</li>
</ul>',
	),
);

foreach ( $works as $w ) {
	$id = wp_insert_post( array(
		'post_type'    => 'works',
		'post_status'  => 'publish',
		'post_title'   => $w['title'],
		'post_content' => trim( $w['content'] ),
		'post_excerpt' => $w['excerpt'],
	) );
	wp_set_object_terms( $id, $w['type'], 'works_type' );
	wp_set_object_terms( $id, $w['skills'], 'skill' );
	if ( $w['industry'] ) { wp_set_object_terms( $id, $w['industry'], 'industry' ); }
	foreach ( $w['meta'] as $k => $v ) { update_post_meta( $id, $k, $v ); }
	WP_CLI::log( 'work created: ' . $w['title'] );
}

/* ---------- 5. お知らせ ---------- */
wp_insert_post( array( 'post_type' => 'news', 'post_status' => 'publish', 'post_title' => 'ポートフォリオサイトを公開しました', 'post_content' => 'shinnosuke-kobayashi.jp を公開しました。実績・コラム・お知らせを随時更新していきます。' ) );

/* ---------- 6. CF7フォーム＋contactページ ---------- */
if ( class_exists( 'WPCF7_ContactForm' ) ) {
	$form = WPCF7_ContactForm::get_template( array( 'title' => 'お問い合わせフォーム' ) );
	$props = $form->get_properties();
	$props['form'] = '<label> 氏名（必須）
    [text* your-name autocomplete:name] </label>

<label> 会社名・所属
    [text your-company autocomplete:organization] </label>

<label> メールアドレス（必須）
    [email* your-email autocomplete:email] </label>

<label> お問い合わせ種別（必須）
    [select* your-type "お仕事のご依頼・ご相談" "実績に関するお問い合わせ" "取材・登壇のご依頼" "その他"] </label>

<label> お問い合わせ内容（必須）
    [textarea* your-message] </label>

[acceptance your-consent] <a href="/privacy/">プライバシーポリシー</a>に同意します [/acceptance]

[submit "送信する"]';
	$props['mail']['subject'] = '[小林慎之助ポートフォリオ] [your-type]';
	$props['mail']['sender']  = '[your-name] <wordpress@shinnosuke-kobayashi.jp>';
	$props['mail']['body']    = "氏名: [your-name]\n会社名・所属: [your-company]\nメール: [your-email]\n種別: [your-type]\n\n本文:\n[your-message]\n\n--\nこのメールはポートフォリオサイトのお問い合わせフォームから送信されました。";
	$props['mail']['additional_headers'] = 'Reply-To: [your-email]';
	$props['mail_2']['active']    = true;
	$props['mail_2']['subject']   = '[小林慎之助] お問い合わせありがとうございます';
	$props['mail_2']['recipient'] = '[your-email]';
	$props['mail_2']['body']      = "[your-name] 様\n\nお問い合わせありがとうございます。\n以下の内容で受け付けました。折り返しご連絡いたします。\n\n種別: [your-type]\n本文:\n[your-message]\n\n--\n小林慎之助";
	$form->set_properties( $props );
	$form_id = $form->save();
	$contact = get_page_by_path( 'contact' );
	if ( $contact ) {
		wp_update_post( array( 'ID' => $contact->ID, 'post_content' => '[contact-form-7 id="' . $form_id . '" title="お問い合わせフォーム"]' ) );
	}
	WP_CLI::log( 'CF7 form created: #' . $form_id );
}

/* ---------- 7. 顔写真 → プロフィールページのアイキャッチ ---------- */
$face = dirname( __FILE__ ) . '/Shinnosuke_Face.png';
$profile = get_page_by_path( 'profile' );
if ( $profile && file_exists( $face ) && ! has_post_thumbnail( $profile->ID ) ) {
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$upload = wp_upload_bits( 'Shinnosuke_Face.png', null, file_get_contents( $face ) );
	if ( empty( $upload['error'] ) ) {
		$att_id = wp_insert_attachment( array(
			'post_mime_type' => 'image/png',
			'post_title'     => '小林慎之助 プロフィール写真',
			'post_status'    => 'inherit',
		), $upload['file'], $profile->ID );
		$meta = wp_generate_attachment_metadata( $att_id, $upload['file'] );
		if ( $meta ) { wp_update_attachment_metadata( $att_id, $meta ); }
		set_post_thumbnail( $profile->ID, $att_id );
		WP_CLI::log( 'profile photo set: #' . $att_id );
	}
}

update_option( 'kb_seeded', 1 );
WP_CLI::success( 'seed done' );
