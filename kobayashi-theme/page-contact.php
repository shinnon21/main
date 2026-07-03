<?php
/**
 * お問い合わせ（設計書 §5.10）
 * スラッグ contact の固定ページに自動適用（テンプレート階層 page-contact.php）。
 * フォーム本体はCF7ショートコード（固定ページ本文側）。装飾は style.css の
 * 「お問い合わせフォーム」セクション。
 */
get_header();
while ( have_posts() ) : the_post();
get_template_part( 'parts/page-hero', null, array( 'label' => 'contact', 'title' => get_the_title() ) );
?>
<div class="sec">
	<div class="container" style="max-width:820px">

		<p class="contact-lead">お仕事のご依頼・ご相談、取材・登壇のご依頼など、お気軽にお送りください。<br>内容を確認のうえ、折り返しご連絡いたします。</p>

		<article class="entry-wrap contact-form-wrap" style="max-width:none">
			<div class="entry-content"><?php the_content(); ?></div>
		</article>

		<div class="contact-alt">
			<p>フォーム以外でも、<a href="https://www.linkedin.com/in/shinnosuke-kobayashi/" target="_blank" rel="noopener">LinkedIn</a>・<a href="https://www.facebook.com/shinnon21" target="_blank" rel="noopener">Facebook</a> からもご連絡いただけます。</p>
		</div>

	</div>
</div>
<?php endwhile; get_footer(); ?>
