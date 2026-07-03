<?php
/* 汎用固定ページ（About・プライバシーポリシー・お問い合わせ等）
   お問い合わせページには本文に Contact Form 7 のショートコードを貼り付けて使用 */
get_header();
while ( have_posts() ) : the_post();
get_template_part( 'parts/page-hero', null, array( 'label' => get_post_field( 'post_name' ), 'title' => get_the_title() ) );
?>
<div class="sec">
	<div class="container" style="max-width:820px">
		<article class="entry-wrap" style="max-width:none">
			<div class="entry-content"><?php the_content(); ?></div>
		</article>
	</div>
</div>
<?php endwhile; get_footer(); ?>
