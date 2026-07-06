<?php
/* コラム一覧（設計書 §5.6） */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'column', 'title' => kb_t( 'コラム', 'Column' ) ) );
?>
<div class="sec">
	<div class="container col-wrap">
		<div>
			<?php if ( have_posts() ) : ?>
				<?php while ( have_posts() ) : the_post(); get_template_part( 'parts/card', 'column' ); endwhile; ?>
				<?php kb_pagination(); ?>
			<?php else : ?>
				<p><?php echo esc_html( kb_t( 'コラムはまだありません。', 'No columns yet.' ) ); ?></p>
			<?php endif; ?>
		</div>
		<aside>
			<?php get_template_part( 'parts/side-ranking' ); ?>
			<div class="side-box">
				<div class="sb-head"><span class="lbl">search</span><h3><?php echo esc_html( kb_t( '条件から探す', 'Advanced search' ) ); ?></h3></div>
				<p style="font-size:12.5px;color:var(--gray);margin-bottom:14px"><?php echo esc_html( kb_t( '期間・種別・タグを組み合わせて記事を検索できます。', 'Search articles by period, type, and tags.' ) ); ?></p>
				<a class="btn ghost sm" href="<?php echo esc_url( kb_home( '/searches/' ) ); ?>"><?php echo esc_html( kb_t( '条件検索へ →', 'Open search →' ) ); ?></a>
			</div>
		</aside>
	</div>
</div>
<?php get_footer(); ?>
