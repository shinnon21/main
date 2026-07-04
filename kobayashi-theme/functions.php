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
	);
}
function kb_sns_links() {
	$icons = array(
		'linkedin'  => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.4 9.2H3.7V20h2.7V9.2zM5 7.9a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM20.4 20h-2.7v-5.6c0-1.4-.5-2.3-1.7-2.3-.9 0-1.5.6-1.7 1.2-.1.2-.1.5-.1.8V20h-2.7V9.2h2.7v1.5c.4-.6 1.2-1.7 3-1.7 2.2 0 3.2 1.4 3.2 4.1V20z"/></svg>',
		'facebook'  => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.6 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4h1.5V5.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.4-3.7 3.9v2H8.1v2.8h2.5V21h3z"/></svg>',
		'instagram' => '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.8" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="17.1" cy="6.9" r="1.3" fill="currentColor"/></svg>',
	);
	$out = '';
	foreach ( kb_sns_accounts() as $key => $a ) {
		if ( empty( $a['url'] ) ) { continue; }
		$out .= '<a class="sns-btn" href="' . esc_url( $a['url'] ) . '" target="_blank" rel="noopener">' . $icons[ $key ] . '<span>' . esc_html( $a['label'] ) . '</span></a>';
	}
	if ( $out ) {
		echo '<div class="sns-row">' . $out . '</div>';
	}
}

/* ---------- 実績種別バッジ ---------- */
function kb_type_badge() {
	$types = get_the_terms( get_the_ID(), 'works_type' );
	if ( $types && ! is_wp_error( $types ) ) {
		echo '<span class="badge accent">' . esc_html( $types[0]->name ) . '</span>';
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
