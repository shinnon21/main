<?php
/* コラム一覧（設計書 §5.6） */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'column', 'title' => 'コラム' ) );
?>
<div class="sec">
	<div class="container col-wrap">
		<div>
			<?php if ( have_posts() ) : ?>
				<?php while ( have_posts() ) : the_post(); get_template_part( 'parts/card', 'column' ); endwhile; ?>
				<?php kb_pagination(); ?>
			<?php else : ?>
				<p>コラムはまだありません。</p>
			<?php endif; ?>
		</div>
		<aside>
			<?php get_template_part( 'parts/side-ranking' ); ?>
			<div class="side-box">
				<div class="sb-head"><span class="lbl">search</span><h3>条件から探す</h3></div>
				<p style="font-size:12.5px;color:var(--gray);margin-bottom:14px">期間・種別・タグを組み合わせて記事を検索できます。</p>
				<a class="btn ghost sm" href="<?php echo esc_url( home_url( '/searches/' ) ); ?>">条件検索へ →</a>
			</div>
		</aside>
	</div>
</div>
<?php get_footer(); ?>
