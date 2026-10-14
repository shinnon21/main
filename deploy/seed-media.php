<?php
/**
 * メディア掲載記事の投入（wp eval-file deploy/seed-media.php で実行）
 *
 * 金沢シーサイドFM出演回（YouTube / Spotify）をお知らせ「メディア掲載」として作成する。
 * 冪等: 同名のお知らせが既にあれば何もしない（管理画面での編集を保護）。
 * 埋め込みはテーマv1.26の ACF欄「メディア埋め込み」（media_youtube / media_spotify）で表示。
 */

if ( ! class_exists( 'WP_CLI' ) ) {
	class WP_CLI {
		public static function log( $m ) { echo $m . "\n"; }
		public static function success( $m ) { echo '✅ ' . $m . "\n"; }
	}
}

$title = '金沢シーサイドFMに出演しました｜政治DXに迫る';

$q = new WP_Query( array( 'post_type' => 'news', 'title' => $title, 'posts_per_page' => 1, 'post_status' => 'any', 'no_found_rows' => true ) );
if ( $q->have_posts() ) {
	WP_CLI::log( 'skip（既に存在）: ' . $title );
	return;
}

$content = '
<p><strong>政治と暮らしの距離を縮め、誰もが参加できる社会をつくる政治DXに迫る！</strong></p>
<p>金沢シーサイドFMの番組に、Weeave株式会社 代表取締役として出演しました。ナビゲーターは藍田隆希さんです。地域や業界で注目されている企業の社長をお招きし、その魅力や取り組みを伺う番組で、政治DXへの思いをお話ししています。</p>
<p>YouTubeとSpotifyで配信中です。ぜひお聴きください。</p>
<ul>
<li><a href="https://www.weeave.co.jp" target="_blank" rel="noopener">Weeave株式会社</a></li>
<li><a href="https://kanazawa-seasidefm.co.jp/" target="_blank" rel="noopener">金沢シーサイドFM</a></li>
</ul>';

$content_en = '
<p><strong>Closing the distance between politics and daily life — a look at political DX that lets everyone take part in society</strong></p>
<p>I appeared on a Kanazawa Seaside FM program as CEO of Weeave Inc. The navigator was Takaki Aida. The show invites presidents of companies drawing attention in the local area and their industries to talk about their appeal and initiatives, and I spoke about my thoughts on political DX.</p>
<p>The episode is available on YouTube and Spotify (in Japanese).</p>
<ul>
<li><a href="https://www.weeave.co.jp" target="_blank" rel="noopener">Weeave Inc.</a></li>
<li><a href="https://kanazawa-seasidefm.co.jp/" target="_blank" rel="noopener">Kanazawa Seaside FM</a></li>
</ul>';

$id = wp_insert_post( array(
	'post_type'    => 'news',
	'post_status'  => 'publish',
	'post_title'   => $title,
	'post_content' => trim( $content ),
	'post_excerpt' => '金沢シーサイドFMの番組に出演し、政治DXについてお話ししました。YouTube・Spotifyで配信中です。',
	'post_date'    => '2026-10-13 12:00:00',
), true );
if ( is_wp_error( $id ) ) {
	WP_CLI::log( 'ERROR: ' . $id->get_error_message() );
	return;
}

wp_set_object_terms( $id, 'メディア掲載', 'news_type' );

$meta = array(
	'media_youtube'  => array( 't55euYAYF1A', 'field_kb_media_youtube' ),
	'media_spotify'  => array( '0Ojd45lWNi7uhh5UG1nkOK', 'field_kb_media_spotify' ),
);
foreach ( $meta as $k => $pair ) {
	update_post_meta( $id, $k, $pair[0] );
	update_post_meta( $id, '_' . $k, $pair[1] );
}

update_post_meta( $id, 'title_en', 'Appeared on Kanazawa Seaside FM — Talking Political DX' );
update_post_meta( $id, 'excerpt_en', 'I appeared on a Kanazawa Seaside FM program and talked about political DX. Available on YouTube and Spotify.' );
update_post_meta( $id, 'content_en', trim( $content_en ) );

WP_CLI::success( 'created news #' . $id . ': ' . $title );
