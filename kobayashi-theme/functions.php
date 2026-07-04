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
