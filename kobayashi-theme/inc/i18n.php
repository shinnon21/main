<?php
/**
 * 日英2言語対応（プラグイン不要のテーマ内i18n）
 *
 * - /en/ プレフィックスで全ページの英語版URLを提供
 *   （トップ・固定ページ・CPTアーカイブ/詳細/ページネーション・タクソノミー・検索）
 * - UI文言は kb_t()、記事本文は post meta（title_en / excerpt_en / content_en。
 *   未入力なら日本語にフォールバック）
 * - EN表示中は WordPress が生成する内部リンクを自動で /en/ 付きに変換
 * - hreflang・lang属性・言語切替リンクを出力
 * - 注意: ルーティング追加のため、デプロイ後にパーマリンクの再保存が必要
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/* ---------- ルーティング ---------- */
add_filter( 'query_vars', function ( $vars ) {
	$vars[] = 'kb_lang';
	$vars[] = 'kb_en_front';
	return $vars;
} );

add_action( 'init', function () {
	/* トップ */
	add_rewrite_rule( '^en/?$', 'index.php?kb_lang=en&kb_en_front=1', 'top' );
	/* 固定ページ */
	add_rewrite_rule( '^en/(profile|about|privacy|contact|searches|documents|chat)/?$', 'index.php?pagename=$matches[1]&kb_lang=en', 'top' );
	/* タクソノミー（CPT詳細のルールより先に定義して先に当てる） */
	add_rewrite_rule( '^en/works/type/([^/]+)/?$', 'index.php?works_type=$matches[1]&kb_lang=en', 'top' );
	add_rewrite_rule( '^en/news/type/([^/]+)/?$', 'index.php?news_type=$matches[1]&kb_lang=en', 'top' );
	add_rewrite_rule( '^en/skill/([^/]+)/?$', 'index.php?skill=$matches[1]&kb_lang=en', 'top' );
	add_rewrite_rule( '^en/industry/([^/]+)/?$', 'index.php?industry=$matches[1]&kb_lang=en', 'top' );
	/* CPT: アーカイブ・ページネーション・詳細 */
	foreach ( array( 'works', 'column', 'news' ) as $pt ) {
		add_rewrite_rule( '^en/' . $pt . '/?$', 'index.php?post_type=' . $pt . '&kb_lang=en', 'top' );
		add_rewrite_rule( '^en/' . $pt . '/page/([0-9]+)/?$', 'index.php?post_type=' . $pt . '&paged=$matches[1]&kb_lang=en', 'top' );
		add_rewrite_rule( '^en/' . $pt . '/([^/]+)/?$', 'index.php?' . $pt . '=$matches[1]&kb_lang=en', 'top' );
	}
} );

/* ---------- 言語判定・翻訳ヘルパー ---------- */
function kb_is_en() {
	return 'en' === get_query_var( 'kb_lang' );
}
function kb_t( $ja, $en ) {
	return kb_is_en() ? $en : $ja;
}
/* テンプレート内の home_url() 直書きの代わりに使う（EN時は /en/ を付ける） */
function kb_home( $path = '/' ) {
	return home_url( ( kb_is_en() ? '/en' : '' ) . $path );
}
/* 投稿タイプの英語ラベル */
function kb_pt_label( $pt = null ) {
	$pt  = $pt ? $pt : get_post_type();
	$map = array( 'works' => 'Works', 'column' => 'Column', 'news' => 'News' );
	if ( kb_is_en() && isset( $map[ $pt ] ) ) { return $map[ $pt ]; }
	$obj = get_post_type_object( $pt );
	return $obj ? $obj->labels->name : '';
}

/* ---------- EN表示中の内部リンクを /en/ 付きに ---------- */
function kb_lang_url( $url ) {
	if ( ! kb_is_en() || ! is_string( $url ) ) { return $url; }
	$home = home_url( '/' );
	if ( 0 !== strpos( $url, $home ) ) { return $url; }
	$path = substr( $url, strlen( $home ) );
	if ( 'en' === $path || 0 === strpos( $path, 'en/' ) || 0 === strpos( $path, 'wp-' ) || 0 === strpos( $path, '?' ) ) { return $url; }
	return $home . 'en/' . $path;
}
foreach ( array( 'post_type_link', 'page_link', 'post_type_archive_link', 'term_link' ) as $kb_hook ) {
	add_filter( $kb_hook, 'kb_lang_url', 20 );
}

/* ---------- ENトップはfront-page.phpで描画（検索クエリ時は除く） ---------- */
add_filter( 'template_include', function ( $tpl ) {
	if ( get_query_var( 'kb_en_front' ) && ! get_query_var( 's' ) ) {
		return get_template_directory() . '/front-page.php';
	}
	return $tpl;
} );

/* ---------- lang属性・hreflang・言語切替 ---------- */
add_filter( 'language_attributes', function ( $output ) {
	return kb_is_en() ? 'lang="en"' : $output;
} );

/* 現在のURLの日英ペア（REQUEST_URIベース） */
function kb_lang_pair() {
	$path = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '/';
	$ja   = preg_replace( '~^/en(/|$)~', '/', $path );
	$en   = ( 0 === strpos( $path, '/en/' ) || '/en' === rtrim( $path, '/' ) ) ? $path : '/en' . $path;
	return array( 'ja' => home_url( $ja ), 'en' => home_url( $en ) );
}
add_action( 'wp_head', function () {
	if ( is_404() ) { return; }
	$pair = kb_lang_pair();
	echo '<link rel="alternate" hreflang="ja" href="' . esc_url( $pair['ja'] ) . '">' . "\n";
	echo '<link rel="alternate" hreflang="en" href="' . esc_url( $pair['en'] ) . '">' . "\n";
	echo '<link rel="alternate" hreflang="x-default" href="' . esc_url( $pair['ja'] ) . '">' . "\n";
}, 5 );

/* <title> のEN化（記事タイトルはtitle_en、サイト名は英語表記に） */
add_filter( 'document_title_parts', function ( $parts ) {
	if ( ! kb_is_en() ) { return $parts; }
	if ( is_singular() ) { $parts['title'] = kb_get_title(); }
	if ( get_query_var( 'kb_en_front' ) && ! get_query_var( 's' ) ) {
		$parts = array( 'title' => 'Shinnosuke Kobayashi Official Website' );
	} else {
		$parts['site'] = 'Shinnosuke Kobayashi Official Website';
	}
	return $parts;
} );

/* 言語切替リンク（ヘッダー・モバイルメニュー用） */
function kb_lang_switcher() {
	$pair = kb_lang_pair();
	if ( kb_is_en() ) {
		echo '<a class="lang-switch" href="' . esc_url( $pair['ja'] ) . '" hreflang="ja" rel="alternate"><span class="on">EN</span><span class="sep">/</span><span>日本語</span></a>';
	} else {
		echo '<a class="lang-switch" href="' . esc_url( $pair['en'] ) . '" hreflang="en" rel="alternate"><span class="on">JA</span><span class="sep">/</span><span>English</span></a>';
	}
}

/* ---------- 記事コンテンツの英語版（metaフォールバック） ---------- */
function kb_get_title( $id = null ) {
	$id = $id ? $id : get_the_ID();
	if ( kb_is_en() ) {
		$en = get_post_meta( $id, 'title_en', true );
		if ( is_string( $en ) && '' !== trim( $en ) ) { return $en; }
	}
	return get_the_title( $id );
}
function kb_the_title() {
	echo esc_html( kb_get_title() );
}
function kb_get_excerpt( $id = null ) {
	$id = $id ? $id : get_the_ID();
	if ( kb_is_en() ) {
		$en = get_post_meta( $id, 'excerpt_en', true );
		if ( is_string( $en ) && '' !== trim( $en ) ) { return $en; }
	}
	return has_excerpt( $id ) ? wp_strip_all_tags( get_the_excerpt( $id ) ) : '';
}
/* 既知のターム名（タクソノミーはDB上日本語）のEN表記。未知はそのまま */
function kb_term_en( $name ) {
	if ( ! kb_is_en() ) { return $name; }
	static $map = array(
		'起業・経営' => 'Founding & Management', 'DX支援' => 'DX Support', '国際事業開発' => 'Global Business Development', 'マーケティング' => 'Marketing', '登壇・講師' => 'Talks & Lectures',
		'政治DX' => 'Political DX', 'データ分析' => 'Data Analysis', '事業開発' => 'Business Development', '東南アジア' => 'Southeast Asia', 'コミュニティ構築' => 'Community Building', '経営工学' => 'Management Science', 'サプライチェーン' => 'Supply Chain', '生成AI活用' => 'Generative AI', 'スタートアップ' => 'Startup',
		'政治・行政' => 'Politics & Government',
	);
	return isset( $map[ $name ] ) ? $map[ $name ] : $name;
}
/* 担当領域（scope・チェックボックス値）のEN表記 */
function kb_scope_label( $v ) {
	if ( ! kb_is_en() ) { return $v; }
	static $map = array(
		'戦略立案' => 'Strategy', '要件定義' => 'Requirements', '設計' => 'System Design', 'デザイン' => 'Design', '実装' => 'Implementation', '運用' => 'Operations',
		'データ分析' => 'Data Analysis', 'リサーチ・調査' => 'Research', 'マーケティング・広報' => 'Marketing & PR', 'コミュニティ運営' => 'Community Management', '講師・登壇' => 'Lecturing & Talks',
	);
	return isset( $map[ $v ] ) ? $map[ $v ] : $v;
}

/* ACF/メタ値の英語版（「<キー>_en」を優先し、未入力なら日本語） */
function kb_field_i18n( $key, $id = null ) {
	if ( kb_is_en() ) {
		$en = kb_field( $key . '_en', $id );
		if ( ( is_string( $en ) && '' !== trim( $en ) ) || ( is_array( $en ) && $en ) ) {
			return $en;
		}
	}
	return kb_field( $key, $id );
}

function kb_the_content() {
	if ( kb_is_en() ) {
		$en = get_post_meta( get_the_ID(), 'content_en', true );
		if ( is_string( $en ) && '' !== trim( $en ) ) {
			echo apply_filters( 'the_content', $en );
			return;
		}
	}
	the_content();
}
