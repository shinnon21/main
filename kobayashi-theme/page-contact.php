<?php
/**
 * お問い合わせ（設計書 §5.10）
 * スラッグ contact の固定ページに自動適用（テンプレート階層 page-contact.php）。
 * フォーム本体はCF7ショートコード（固定ページ本文側）。装飾は style.css の
 * 「お問い合わせフォーム」セクション。
 */
get_header();
/* 送信完了で画面を切り替えるスクリプト（お問い合わせページのみ） */
wp_enqueue_script( 'kb-contact', get_template_directory_uri() . '/assets/contact.js', array(), wp_get_theme()->get( 'Version' ), true );
while ( have_posts() ) : the_post();
get_template_part( 'parts/page-hero', null, array( 'label' => 'contact', 'title' => kb_get_title() ) );
?>
<div class="sec">
	<div class="container" style="max-width:820px">

		<div id="contactMain">
			<p class="contact-lead"><?php echo wp_kses( kb_t( 'お仕事のご依頼・ご相談、取材・登壇のご依頼など、お気軽にお送りください。<br>内容を確認のうえ、折り返しご連絡いたします。', 'For work inquiries, consulting, interview or speaking requests — please feel free to get in touch.<br>I will review your message and get back to you.' ), array( 'br' => array() ) ); ?></p>

			<article class="entry-wrap contact-form-wrap" style="max-width:none">
				<div class="entry-content"><?php kb_the_content(); ?></div>
			</article>

			<div class="contact-alt">
				<p><?php echo esc_html( kb_t( 'フォームのほか、各SNSのDMからもご連絡いただけます。', 'You can also reach me by DM on any of these social accounts.' ) ); ?></p>
				<?php kb_sns_links(); ?>
			</div>
		</div>

		<?php /* 送信成功時に contact.js がフォーム一式(#contactMain)と差し替えるサンクス画面 */ ?>
		<div id="contactThanks" class="contact-thanks" hidden>
			<div class="ct-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12.5l5 5L20 6.5" stroke="#C22740" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
			</div>
			<h2><?php echo esc_html( kb_t( 'お問い合わせありがとうございます', 'Thank you for your message' ) ); ?></h2>
			<p><?php echo wp_kses( kb_t( 'メッセージを送信しました。<br>内容を確認のうえ、数日を目安に折り返しご連絡いたします。', 'Your message has been sent.<br>I will review it and get back to you, usually within a few business days.' ), array( 'br' => array() ) ); ?></p>
			<p class="ct-note"><?php echo esc_html( kb_t( '自動返信メールが届かない場合は、迷惑メールフォルダをご確認ください。', 'If you don’t receive an auto-reply, please check your spam folder.' ) ); ?></p>
			<div class="ct-cta">
				<a class="btn primary" href="<?php echo esc_url( kb_home( '/' ) ); ?>"><?php echo esc_html( kb_t( 'トップへ戻る', 'Back to home' ) ); ?></a>
				<a class="btn ghost" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>"><?php echo esc_html( kb_t( '実績を見る →', 'View works →' ) ); ?></a>
			</div>
		</div>

	</div>
</div>
<?php endwhile; get_footer(); ?>
