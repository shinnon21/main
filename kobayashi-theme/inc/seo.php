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
	if ( is_singular() && has_post_thumbnail() ) {
		$image = get_the_post_thumbnail_url( get_the_ID(), 'large' );
	}
	if ( ! $image ) {
		$image = get_template_directory_uri() . '/assets/img/logo-mark.png';
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
	echo '<meta property="og:locale" content="ja_JP">' . "\n";
	echo '<meta name="twitter:card" content="' . ( is_singular() && has_post_thumbnail() ? 'summary_large_image' : 'summary' ) . '">' . "\n";
}, 6 );

/* ---------- JSON-LD: Person（設計書 Phase2「構造化データ強化」） ---------- */
function kb_jsonld_person() {
	return array(
		'@type'         => 'Person',
		'name'          => '小林 慎之助',
		'alternateName' => 'Shinnosuke Kobayashi',
		'url'           => home_url( '/profile/' ),
		'jobTitle'      => '共同創業者・代表取締役 CEO',
		'affiliation'   => array(
			array( '@type' => 'Organization', 'name' => 'Weeave株式会社', 'url' => 'https://www.weeave.co.jp/' ),
			array( '@type' => 'CollegeOrUniversity', 'name' => '筑波大学' ),
		),
		'sameAs'        => array(
			'https://www.linkedin.com/in/shinnosuke-kobayashi/',
			'https://www.facebook.com/shinnon21',
			'https://note.com/shinnon21',
		),
	);
}

add_action( 'wp_head', function () {
	$graph = array();

	if ( is_front_page() || is_page( 'profile' ) ) {
		$graph[] = kb_jsonld_person();
	} elseif ( is_singular( array( 'works', 'column' ) ) ) {
		$article = array(
			'@type'         => 'Article',
			'headline'      => get_the_title(),
			'datePublished' => get_the_date( 'c' ),
			'dateModified'  => get_the_modified_date( 'c' ),
			'mainEntityOfPage' => get_permalink(),
			'author'        => kb_jsonld_person(),
		);
		if ( has_excerpt() ) {
			$article['description'] = wp_strip_all_tags( get_the_excerpt() );
		}
		if ( has_post_thumbnail() ) {
			$article['image'] = get_the_post_thumbnail_url( get_the_ID(), 'large' );
		}
		$graph[] = $article;
	}

	if ( ! $graph ) { return; }
	$data = array( '@context' => 'https://schema.org', '@graph' => $graph );
	echo '<script type="application/ld+json">' . wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
}, 7 );
