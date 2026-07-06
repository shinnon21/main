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
		$ex = kb_get_excerpt();
		if ( $ex ) {
			return $ex;
		}
		$body = kb_is_en() ? get_post_meta( get_the_ID(), 'content_en', true ) : '';
		if ( ! is_string( $body ) || '' === trim( $body ) ) {
			$body = get_post_field( 'post_content', get_the_ID() );
		}
		return wp_trim_words( wp_strip_all_tags( $body ), 60, '…' );
	}
	if ( is_tax() || is_tag() || is_category() ) {
		return sprintf( kb_t( '%sに関する実績・記事の一覧です。', 'Works and articles related to %s.' ), kb_term_en( single_term_title( '', false ) ) );
	}
	if ( is_post_type_archive() ) {
		return kb_is_en() ? sprintf( 'A list of %s by Shinnosuke Kobayashi.', kb_pt_label() ) : post_type_archive_title( '', false ) . 'の一覧です。';
	}
	return kb_t( get_bloginfo( 'description' ), 'From political and governmental DX to pharmaceutical supply chain research — the official website of Shinnosuke Kobayashi.' );
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
	return kb_home( '/' );
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
	echo '<meta property="og:site_name" content="' . esc_attr( kb_t( get_bloginfo( 'name' ), 'Shinnosuke Kobayashi Official Website' ) ) . '">' . "\n";
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
	echo '<meta property="og:locale" content="' . esc_attr( kb_t( 'ja_JP', 'en_US' ) ) . '">' . "\n";
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
		'alternateName' => kb_t( 'Shinnosuke Kobayashi', '小林 慎之助' ),
		'url'           => kb_home( '/profile/' ),
		'jobTitle'      => kb_t( '共同創業者・代表取締役 CEO', 'Co-founder & CEO' ),
		'description'   => wp_trim_words( kb_profile_field( 'profile_bio' ), 60, '…' ),
		'affiliation'   => array(
			array( '@type' => 'Organization', 'name' => kb_t( 'Weeave株式会社', 'Weeave Inc.' ), 'url' => 'https://www.weeave.co.jp/' ),
		),
		'alumniOf'      => array( '@type' => 'CollegeOrUniversity', 'name' => kb_t( '筑波大学', 'University of Tsukuba' ) ),
		'knowsAbout'    => kb_is_en()
			? array( 'Political & governmental DX', 'Data analysis', 'Business development', 'Management science', 'Pharmaceutical supply chains', 'Election simulation', 'Marketing & PR', 'Community building' )
			: array( '政治・行政のDX', 'データ分析', '事業開発', '経営工学', '医薬品サプライチェーン', '選挙シミュレーション', 'マーケティング・広報', 'コミュニティ構築' ),
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
			array( '@type' => 'ListItem', 'position' => 1, 'name' => kb_t( 'ホーム', 'Home' ), 'item' => kb_home( '/' ) ),
			array( '@type' => 'ListItem', 'position' => 2, 'name' => kb_pt_label(), 'item' => get_post_type_archive_link( get_post_type() ) ),
			array( '@type' => 'ListItem', 'position' => 3, 'name' => kb_get_title() ),
		),
	);
}

add_action( 'wp_head', function () {
	$graph = array();

	if ( is_front_page() || get_query_var( 'kb_en_front' ) ) {
		$graph[] = array(
			'@type'           => 'WebSite',
			'name'            => kb_t( get_bloginfo( 'name' ), 'Shinnosuke Kobayashi Official Website' ),
			'url'             => kb_home( '/' ),
			'inLanguage'      => kb_t( 'ja', 'en' ),
			'description'     => kb_t( get_bloginfo( 'description' ), 'From political and governmental DX to pharmaceutical supply chain research — the official website of Shinnosuke Kobayashi.' ),
			'potentialAction' => array(
				'@type'       => 'SearchAction',
				'target'      => array( '@type' => 'EntryPoint', 'urlTemplate' => kb_home( '/' ) . '?s={search_term_string}' ),
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
			'headline'      => kb_get_title(),
			'datePublished' => get_the_date( 'c' ),
			'dateModified'  => get_the_modified_date( 'c' ),
			'inLanguage'    => kb_t( 'ja', 'en' ),
			'mainEntityOfPage' => get_permalink(),
			'author'        => kb_jsonld_person(),
		);
		$kb_ex = kb_get_excerpt();
		if ( $kb_ex ) {
			$article['description'] = $kb_ex;
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
