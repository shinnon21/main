<?php
/* フリーワード検索結果（F-01） */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'search', 'title' => sprintf( kb_t( '「%s」の検索結果', 'Search results for “%s”' ), get_search_query() ) ) );
?>
<div class="sec">
	<div class="container col-wrap">
		<div>
			<?php if ( have_posts() ) : ?>
				<p class="result-count"><?php echo esc_html( sprintf( kb_t( '全 %d 件', '%d results' ), (int) $GLOBALS['wp_query']->found_posts ) ); ?></p>
				<?php while ( have_posts() ) : the_post(); get_template_part( 'parts/card', 'column' ); endwhile; ?>
				<?php kb_pagination(); ?>
			<?php else : ?>
				<div class="notfound" style="padding:60px 24px">
					<p><?php echo esc_html( sprintf( kb_t( '「%s」に一致するコンテンツが見つかりませんでした。', 'No content matched “%s”.' ), get_search_query() ) ); ?></p>
					<div class="links">
						<a class="btn ghost sm" href="<?php echo esc_url( kb_home( '/searches/' ) ); ?>"><?php echo esc_html( kb_t( '条件から探す', 'Advanced search' ) ); ?></a>
						<a class="btn ghost sm" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>"><?php echo esc_html( kb_t( '実績一覧へ', 'View works' ) ); ?></a>
					</div>
				</div>
			<?php endif; ?>
		</div>
		<aside><?php get_template_part( 'parts/side-ranking' ); ?></aside>
	</div>
</div>
<?php get_footer(); ?>
