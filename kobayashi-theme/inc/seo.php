<?php
/**
 * SEO出力（設計書 §8／残タスク「OGP設定」「構造化データ強化」）
 *
 * - meta description・OGP・Twitterカードのフォールバック出力
 *   （SEO SIMPLE PACK 等のSEOプラグイン有効時は重複を避けて出力しない）
 * - JSON-LD: Person（トップ・プロフィール）／Article（実績・コラム詳細）
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/* ---------- SEOプラグイン検出 ---------- */
function kb_seo_plugin_active() {
	return defined( 'SSP_VERSION' )                  // SEO SIMPLE PACK
		|| defined( 'WPSEO_VERSION' )                // Yoast SEO
		|| defined( 'AIOSEO_VERSION' )               // All in One SEO
		|| class_exists( 'RankMath' );               // Rank Math
}

/* ---------- description文字列 ---------- */
function kb_meta_description() {
	if ( is_singular() ) {
		if ( has_excerpt() ) {
			return wp_strip_all_tags( get_the_excerpt() );
		}
		return wp_trim_words( wp_strip_all_tags( get_post_field( 'post_content', get_the_ID() ) ), 60, '…' );
	}
	if ( is_tax() || is_tag() || is_category() ) {
		return single_term_title( '', false ) . 'に関する実績・記事の一覧です。';
	}
	if ( is_post_type_archive() ) {
		return post_type_archive_title( '', false ) . 'の一覧です。';
	}
	return get_bloginfo( 'description' );
}

/* ---------- 現在URL ---------- */
function kb_canonical_url() {
	if ( is_singular() ) { return get_permalink(); }
	if ( is_post_type_archive() ) { return get_post_type_archive_link( get_post_type() ?: 'works' ); }
	if ( is_tax() || is_tag() || is_category() ) {
		$term = get_queried_object();
		$link = ( $term && ! is_wp_error( $term ) ) ? get_term_link( $term ) : '';
		if ( $link && ! is_wp_error( $link ) ) { return $link; }
	}
	return home_url( '/' );
}

/* ---------- meta description + OGP + Twitterカード ---------- */
add_action( 'wp_head', function () {
	if ( kb_seo_plugin_active() ) { return; }

	$desc  = kb_meta_description();
	$url   = kb_canonical_url();
	$title = wp_get_document_title();
	$type  = is_singular( array( 'works', 'column', 'news' ) ) ? 'article' : 'website';
	$image = '';
	$w = $h = 0;
	if ( is_singular() && has_post_thumbnail() ) {
		$image = get_the_post_thumbnail_url( get_the_ID(), 'large' );
	}
	if ( ! $image ) {
		$image = get_template_directory_uri() . '/assets/img/og-default.png';
		$w = 1200;
		$h = 630;
	}

	if ( $desc ) {
		echo '<meta name="description" content="' . esc_attr( $desc ) . '">' . "\n";
	}
	echo '<meta property="og:site_name" content="' . esc_attr( get_bloginfo( 'name' ) ) . '">' . "\n";
	echo '<meta property="og:title" content="' . esc_attr( $title ) . '">' . "\n";
	echo '<meta property="og:type" content="' . esc_attr( $type ) . '">' . "\n";
	echo '<meta property="og:url" content="' . esc_url( $url ) . '">' . "\n";
	if ( $desc ) {
		echo '<meta property="og:description" content="' . esc_attr( $desc ) . '">' . "\n";
	}
	echo '<meta property="og:image" content="' . esc_url( $image ) . '">' . "\n";
	if ( $w ) {
		echo '<meta property="og:image:width" content="' . (int) $w . '"><meta property="og:image:height" content="' . (int) $h . '">' . "\n";
	}
	echo '<meta property="og:locale" content="ja_JP">' . "\n";
	echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
}, 6 );

/* ---------- JSON-LD: Person（設計書 Phase2「構造化データ強化」） ----------
   名前・肩書・自己紹介・SNSはプロフィール編集欄／kb_sns_accounts()と連動 */
function kb_jsonld_person() {
	$same_as = array();
	foreach ( kb_sns_accounts() as $a ) {
		if ( ! empty( $a['url'] ) ) { $same_as[] = $a['url']; }
	}
	$person = array(
		'@type'         => 'Person',
		'name'          => kb_profile_field( 'profile_name' ),
		'alternateName' => 'Shinnosuke Kobayashi',
		'url'           => home_url( '/profile/' ),
		'jobTitle'      => '共同創業者・代表取締役 CEO',
		'description'   => wp_trim_words( kb_profile_field( 'profile_bio' ), 60, '…' ),
		'affiliation'   => array(
			array( '@type' => 'Organization', 'name' => 'Weeave株式会社', 'url' => 'https://www.weeave.co.jp/' ),
		),
		'alumniOf'      => array( '@type' => 'CollegeOrUniversity', 'name' => '筑波大学' ),
		'knowsAbout'    => array( '政治・行政のDX', 'データ分析', '事業開発', '経営工学', '医薬品サプライチェーン', '選挙シミュレーション', 'マーケティング・広報', 'コミュニティ構築' ),
		'sameAs'        => $same_as,
	);
	$profile = get_page_by_path( 'profile' );
	if ( $profile && has_post_thumbnail( $profile->ID ) ) {
		$person['image'] = get_the_post_thumbnail_url( $profile->ID, 'large' );
	}
	return $person;
}

/* ---------- JSON-LD: パンくず（実績・コラム・お知らせ詳細） ---------- */
function kb_jsonld_breadcrumbs() {
	$pt = get_post_type_object( get_post_type() );
	if ( ! $pt ) { return null; }
	return array(
		'@type'           => 'BreadcrumbList',
		'itemListElement' => array(
			array( '@type' => 'ListItem', 'position' => 1, 'name' => 'ホーム', 'item' => home_url( '/' ) ),
			array( '@type' => 'ListItem', 'position' => 2, 'name' => $pt->labels->name, 'item' => get_post_type_archive_link( get_post_type() ) ),
			array( '@type' => 'ListItem', 'position' => 3, 'name' => get_the_title() ),
		),
	);
}

add_action( 'wp_head', function () {
	$graph = array();

	if ( is_front_page() ) {
		$graph[] = array(
			'@type'           => 'WebSite',
			'name'            => get_bloginfo( 'name' ),
			'url'             => home_url( '/' ),
			'inLanguage'      => 'ja',
			'description'     => get_bloginfo( 'description' ),
			'potentialAction' => array(
				'@type'       => 'SearchAction',
				'target'      => array( '@type' => 'EntryPoint', 'urlTemplate' => home_url( '/?s={search_term_string}' ) ),
				'query-input' => 'required name=search_term_string',
			),
		);
		$graph[] = kb_jsonld_person();
	} elseif ( is_page( 'profile' ) ) {
		$graph[] = array(
			'@type'      => 'ProfilePage',
			'url'        => get_permalink(),
			'mainEntity' => kb_jsonld_person(),
		);
	} elseif ( is_singular( array( 'works', 'column', 'news' ) ) ) {
		$article = array(
			'@type'         => is_singular( 'news' ) ? 'NewsArticle' : 'Article',
			'headline'      => get_the_title(),
			'datePublished' => get_the_date( 'c' ),
			'dateModified'  => get_the_modified_date( 'c' ),
			'inLanguage'    => 'ja',
			'mainEntityOfPage' => get_permalink(),
			'author'        => kb_jsonld_person(),
		);
		if ( has_excerpt() ) {
			$article['description'] = wp_strip_all_tags( get_the_excerpt() );
		}
		$article['image'] = has_post_thumbnail()
			? get_the_post_thumbnail_url( get_the_ID(), 'large' )
			: get_template_directory_uri() . '/assets/img/og-default.png';
		$graph[] = $article;
		$crumbs  = kb_jsonld_breadcrumbs();
		if ( $crumbs ) { $graph[] = $crumbs; }
	}

	if ( ! $graph ) { return; }
	$data = array( '@context' => 'https://schema.org', '@graph' => $graph );
	echo '<script type="application/ld+json">' . wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
}, 7 );
