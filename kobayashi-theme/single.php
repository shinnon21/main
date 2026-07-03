<?php
/* 汎用詳細（お知らせ等） */
get_header();
while ( have_posts() ) : the_post();
?>
<div class="sec">
	<div class="container" style="max-width:820px">
		<?php kb_breadcrumbs(); ?>
		<article class="entry-wrap" style="margin-top:18px;max-width:none">
			<header class="entry-head">
				<div class="meta"><?php kb_dates(); ?></div>
				<h1><?php the_title(); ?></h1>
			</header>
			<div class="entry-content"><?php the_content(); ?></div>
		</article>
		<div class="center-btn"><a class="btn ghost" href="<?php echo esc_url( get_post_type_archive_link( get_post_type() ) ?: home_url( '/' ) ); ?>">一覧へ戻る</a></div>
	</div>
</div>
<?php endwhile; get_footer(); ?>
