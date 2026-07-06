<?php
/* フォールバックテンプレート */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'archive', 'title' => get_the_archive_title() ?: kb_t( '記事一覧', 'Articles' ) ) );
?>
<div class="sec">
	<div class="container col-wrap">
		<div>
			<?php if ( have_posts() ) : ?>
				<?php while ( have_posts() ) : the_post(); get_template_part( 'parts/card', 'column' ); endwhile; ?>
				<?php kb_pagination(); ?>
			<?php else : ?>
				<p><?php echo esc_html( kb_t( 'コンテンツはまだありません。', 'No content yet.' ) ); ?></p>
			<?php endif; ?>
		</div>
		<aside><?php get_template_part( 'parts/side-ranking' ); ?></aside>
	</div>
</div>
<?php get_footer(); ?>
