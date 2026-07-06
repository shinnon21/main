<?php
/**
 * お問い合わせ（設計書 §5.10）
 * スラッグ contact の固定ページに自動適用（テンプレート階層 page-contact.php）。
 * フォーム本体はCF7ショートコード（固定ページ本文側）。装飾は style.css の
 * 「お問い合わせフォーム」セクション。
 */
get_header();
while ( have_posts() ) : the_post();
get_template_part( 'parts/page-hero', null, array( 'label' => 'contact', 'title' => kb_get_title() ) );
?>
<div class="sec">
	<div class="container" style="max-width:820px">

		<p class="contact-lead"><?php echo wp_kses( kb_t( 'お仕事のご依頼・ご相談、取材・登壇のご依頼など、お気軽にお送りください。<br>内容を確認のうえ、折り返しご連絡いたします。', 'For work inquiries, consulting, interview or speaking requests — please feel free to get in touch.<br>I will review your message and get back to you.' ), array( 'br' => array() ) ); ?></p>

		<article class="entry-wrap contact-form-wrap" style="max-width:none">
			<div class="entry-content"><?php kb_the_content(); ?></div>
		</article>

		<div class="contact-alt">
			<p><?php echo esc_html( kb_t( 'フォームのほか、各SNSのDMからもご連絡いただけます。', 'You can also reach me by DM on any of these social accounts.' ) ); ?></p>
			<?php kb_sns_links(); ?>
		</div>

	</div>
</div>
<?php endwhile; get_footer(); ?>
