<?php
/* 汎用タームアーカイブ（skill / industry） */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'tag', 'title' => '# ' . kb_term_en( single_term_title( '', false ) ) ) );
?>
<div class="sec">
	<div class="container col-wrap">
		<div>
			<?php if ( have_posts() ) : ?>
				<?php while ( have_posts() ) : the_post(); get_template_part( 'parts/card', 'column' ); endwhile; ?>
				<?php kb_pagination(); ?>
			<?php else : ?>
				<p><?php echo esc_html( kb_t( '該当するコンテンツはまだありません。', 'No content yet.' ) ); ?></p>
			<?php endif; ?>
		</div>
		<aside><?php get_template_part( 'parts/side-ranking' ); ?></aside>
	</div>
</div>
<?php get_footer(); ?>
