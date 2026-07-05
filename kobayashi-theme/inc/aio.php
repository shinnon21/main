<?php
/**
 * AIO（AI最適化）＋クローラビリティ
 *
 * - robots.txt: サイトマップの案内＋主要AIクローラーの明示的な許可
 *   （AI検索・AIアシスタントからの参照・引用を歓迎する方針）
 * - /llms.txt: LLM向けのサイト概要（llmstxt.org 形式のMarkdown）を動的生成
 *   ※ルーティング追加のため、デプロイ後にパーマリンクの再保存が必要
 * - noindex: サイト内検索結果・条件検索の絞り込み結果（重複コンテンツ対策）
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/* ---------- robots.txt ---------- */
add_filter( 'robots_txt', function ( $output, $public ) {
	if ( '1' !== $public ) { return $output; }
	$bots = array(
		'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',      // OpenAI
		'ClaudeBot', 'Claude-Web', 'anthropic-ai',      // Anthropic
		'PerplexityBot', 'Perplexity-User',             // Perplexity
		'Google-Extended',                              // Gemini学習
		'CCBot', 'meta-externalagent',                  // Common Crawl / Meta
	);
	$output .= "\n# AIクローラーを明示的に許可（AI検索・アシスタントからの参照を歓迎）\n";
	foreach ( $bots as $bot ) {
		$output .= "User-agent: {$bot}\nAllow: /\n\n";
	}
	$output .= '# LLM向けサイト概要: ' . home_url( '/llms.txt' ) . "\n";
	$output .= 'Sitemap: ' . home_url( '/wp-sitemap.xml' ) . "\n";
	return $output;
}, 10, 2 );

/* ---------- /llms.txt（LLM向けサイト概要） ---------- */
add_action( 'init', function () {
	add_rewrite_rule( '^llms\.txt$', 'index.php?kb_llms_txt=1', 'top' );
} );
add_filter( 'query_vars', function ( $vars ) {
	$vars[] = 'kb_llms_txt';
	return $vars;
} );
add_action( 'template_redirect', function () {
	if ( ! get_query_var( 'kb_llms_txt' ) ) { return; }

	header( 'Content-Type: text/plain; charset=utf-8' );
	header( 'X-Robots-Tag: noindex' );

	$lines   = array();
	$lines[] = '# ' . get_bloginfo( 'name' );
	$lines[] = '';
	$lines[] = '> ' . get_bloginfo( 'description' );
	$lines[] = '';
	$lines[] = kb_profile_field( 'profile_bio' );
	$lines[] = '';
	$lines[] = '- 名前: ' . kb_profile_field( 'profile_name' ) . '（' . kb_profile_field( 'profile_kana' ) . '）';
	$lines[] = '- 肩書: ' . kb_profile_field( 'profile_role' );
	$lines[] = '- 研究テーマ: ' . kb_profile_field( 'profile_research_title' );
	$lines[] = '';
	$lines[] = '## 主要ページ';
	$lines[] = '';
	$lines[] = '- [プロフィール](' . home_url( '/profile/' ) . '): 経歴・スキル・研究テーマ・登壇歴';
	$lines[] = '- [実績一覧](' . get_post_type_archive_link( 'works' ) . '): プロジェクト実績のケーススタディ';
	$lines[] = '- [コラム一覧](' . get_post_type_archive_link( 'column' ) . '): 政治・行政DXや社会実装に関する発信';
	$lines[] = '- [お問い合わせ](' . home_url( '/contact/' ) . ')';

	foreach ( array( 'works' => '## 実績', 'column' => '## コラム' ) as $pt => $head ) {
		$q = new WP_Query( array( 'post_type' => $pt, 'posts_per_page' => 20, 'no_found_rows' => true ) );
		if ( ! $q->have_posts() ) { continue; }
		$lines[] = '';
		$lines[] = $head;
		$lines[] = '';
		while ( $q->have_posts() ) {
			$q->the_post();
			$excerpt = has_excerpt() ? ': ' . wp_strip_all_tags( get_the_excerpt() ) : '';
			$lines[] = '- [' . get_the_title() . '](' . get_permalink() . ')' . $excerpt;
		}
		wp_reset_postdata();
	}

	$lines[] = '';
	$lines[] = '## SNS';
	$lines[] = '';
	foreach ( kb_sns_accounts() as $a ) {
		if ( ! empty( $a['url'] ) ) { $lines[] = '- ' . $a['label'] . ': ' . $a['url']; }
	}

	echo implode( "\n", $lines ) . "\n";
	exit;
} );

/* ---------- noindex（重複コンテンツ対策） ---------- */
add_filter( 'wp_robots', function ( $robots ) {
	$filtered_search = is_page( 'searches' ) && ! empty( $_GET );
	if ( is_search() || $filtered_search ) {
		$robots['noindex'] = true;
		$robots['follow']  = true;
	}
	return $robots;
} );
