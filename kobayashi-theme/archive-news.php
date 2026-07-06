<?php
/* お知らせ一覧 */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'news', 'title' => kb_t( 'お知らせ', 'News' ) ) );
?>
<div class="sec">
	<div class="container" style="max-width:820px">
		<?php if ( have_posts() ) : ?>
		<div class="news-list">
			<?php while ( have_posts() ) : the_post(); ?>
			<a class="news-item" href="<?php the_permalink(); ?>">
				<span class="d"><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></span>
				<?php kb_news_type_badge(); ?>
				<span class="t"><?php kb_the_title(); ?></span>
			</a>
			<?php endwhile; ?>
		</div>
		<?php kb_pagination(); ?>
		<?php else : ?>
		<p><?php echo esc_html( kb_t( 'お知らせはまだありません。', 'No news yet.' ) ); ?></p>
		<?php endif; ?>
	</div>
</div>
<?php get_footer(); ?>
