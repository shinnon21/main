<?php
// 読み取り専用。公開CPT・メタ・タクソノミー・添付・オプションをJSONで出力する。
// 実行: sudo -u www-data wp --path=<WPルート> eval-file wp-export.php > export.json
$types = array('works', 'column', 'news', 'page');
$posts = array();
foreach ($types as $t) {
	$q = get_posts(array('post_type' => $t, 'post_status' => 'any', 'numberposts' => -1, 'suppress_filters' => true));
	foreach ($q as $p) {
		$meta = array();
		foreach (get_post_meta($p->ID) as $k => $vals) {
			if ($k === '_thumbnail_id') continue;
			$meta[$k] = maybe_unserialize($vals[0]);
		}
		$terms = array();
		foreach (get_object_taxonomies($t) as $tax) {
			foreach ((array) wp_get_object_terms($p->ID, $tax) as $term) {
				$terms[] = array('taxonomy' => $tax, 'slug' => $term->slug);
			}
		}
		$posts[] = array(
			'id' => $p->ID, 'type' => $t, 'slug' => $p->post_name, 'status' => $p->post_status,
			'title' => $p->post_title, 'excerpt' => $p->post_excerpt, 'content' => $p->post_content,
			'date' => $p->post_date_gmt, 'modified' => $p->post_modified_gmt,
			'thumbnail_id' => get_post_thumbnail_id($p->ID) ?: null, 'menu_order' => (int) $p->menu_order,
			'password_protected' => $p->post_password !== '',
			'meta' => $meta, 'terms' => $terms, 'views' => (int) get_post_meta($p->ID, 'kb_views', true),
		);
	}
}
$terms = array();
foreach (array('works_type', 'skill', 'industry', 'news_type') as $tax) {
	foreach (get_terms(array('taxonomy' => $tax, 'hide_empty' => false)) as $x) {
		$terms[] = array('taxonomy' => $tax, 'slug' => $x->slug, 'name' => $x->name, 'description' => $x->description);
	}
}
$atts = array();
foreach (get_posts(array('post_type' => 'attachment', 'post_status' => 'any', 'numberposts' => -1)) as $a) {
	$atts[] = array('id' => $a->ID, 'path' => get_post_meta($a->ID, '_wp_attached_file', true), 'mime' => $a->post_mime_type);
}
$opts = array();
foreach (array('blogname', 'blogdescription') as $o) $opts[$o] = (string) get_option($o);
echo wp_json_encode(array('exported_at' => gmdate('c'), 'site_url' => home_url(), 'posts' => $posts, 'terms' => $terms, 'attachments' => $atts, 'options' => $opts), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
