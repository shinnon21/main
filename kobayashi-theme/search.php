<?php
/* フリーワード検索結果（F-01） */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'search', 'title' => '「' . get_search_query() . '」の検索結果' ) );
?>
<div class="sec">
	<div class="container col-wrap">
		<div>
			<?php if ( have_posts() ) : ?>
				<p class="result-count">全 <?php echo (int) $GLOBALS['wp_query']->found_posts; ?> 件</p>
				<?php while ( have_posts() ) : the_post(); get_template_part( 'parts/card', 'column' ); endwhile; ?>
				<?php kb_pagination(); ?>
			<?php else : ?>
				<div class="notfound" style="padding:60px 24px">
					<p>「<?php echo esc_html( get_search_query() ); ?>」に一致するコンテンツが見つかりませんでした。</p>
					<div class="links">
						<a class="btn ghost sm" href="<?php echo esc_url( home_url( '/searches/' ) ); ?>">条件から探す</a>
						<a class="btn ghost sm" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>">実績一覧へ</a>
					</div>
				</div>
			<?php endif; ?>
		</div>
		<aside><?php get_template_part( 'parts/side-ranking' ); ?></aside>
	</div>
</div>
<?php get_footer(); ?>
