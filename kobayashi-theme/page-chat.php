<?php
/**
 * Template Name: AIチャット（全画面アバター）
 *
 * 大きなキャラアバターを中央に据えたフルスクリーンのAIチャット体験。
 * 既存REST（kobayashi/v1/chat）とMarkdownレンダラー（assets/chat-page.js）を流用。
 * アバターは応答中に表情（口パク・首振り等）が動く（CSS/SVGのみ）。
 * チャットボット無効時は「準備中」を表示する。
 */
get_header();
$kb_enabled  = kb_chatbot_enabled();
$kb_suggests = array(
	kb_t( '実績を教えてください', 'Tell me about your work.' ),
	kb_t( '経歴について聞きたいです', "I'd like to hear about your career." ),
	kb_t( '研究テーマは何ですか？', 'What is your research about?' ),
	kb_t( '仕事の相談をしたいです', "I'd like to discuss working together." ),
);
?>
<div class="kbc-page">
	<div class="container kbc-stage">
		<div class="kbc-hero">
			<?php echo kb_chat_avatar_svg(); // Lottieアバター（自前の安全なマークアップ） ?>
			<h1><?php echo esc_html( kb_t( '小林慎之助と話してみる', 'Chat with Shinnosuke Kobayashi' ) ); ?></h1>
			<p class="kbc-sub"><?php echo esc_html( kb_t( '本人に代わってAIが、このサイトに掲載されている実績・経歴・お知らせなどをもとにお答えします。掲載のない内容にはお答えできません。', 'An AI answers on his behalf, based on the works, career and news published on this site. Questions beyond it cannot be answered.' ) ); ?></p>
		</div>

		<?php if ( $kb_enabled ) : ?>
		<div class="kbc-chatcard" id="kbcChat">
			<div class="kbc-log kb-chat-body" id="kbcLog" aria-live="polite">
				<div class="kb-chat-msg model"><?php echo esc_html( kb_t( 'こんにちは、小林慎之助です！気になることを、気軽に聞いてくださいね。', "Hi, I'm Shinnosuke Kobayashi! Feel free to ask me anything." ) ); ?></div>
				<div class="kb-chat-suggests" id="kbcSuggests">
					<?php foreach ( $kb_suggests as $q ) : ?>
					<button type="button" class="kb-chat-suggest"><?php echo esc_html( $q ); ?></button>
					<?php endforeach; ?>
				</div>
			</div>
			<form class="kb-chat-form kbc-form" id="kbcForm">
				<input type="text" id="kbcInput" maxlength="800" autocomplete="off" placeholder="<?php echo esc_attr( kb_t( '質問を入力…', 'Type a question…' ) ); ?>" aria-label="<?php echo esc_attr( kb_t( '質問', 'Question' ) ); ?>">
				<button type="submit" class="kb-chat-send" aria-label="<?php echo esc_attr( kb_t( '送信', 'Send' ) ); ?>">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
				</button>
			</form>
			<p class="kbc-note"><?php echo esc_html( kb_t( '回答はAIが自動生成します。正確な内容はお問い合わせください。', 'Answers are generated automatically by AI. For accurate details, please contact directly.' ) ); ?></p>
		</div>
		<?php else : ?>
		<div class="kbc-chatcard kbc-prep">
			<p><?php echo esc_html( kb_t( 'AIとの会話は現在準備中です。近日公開予定です。', 'The AI chat is being prepared and will be available soon.' ) ); ?></p>
			<a class="btn primary" href="<?php echo esc_url( kb_home( '/contact/' ) ); ?>"><?php echo esc_html( kb_t( 'お問い合わせはこちら →', 'Contact →' ) ); ?></a>
		</div>
		<?php endif; ?>
	</div>
</div>
<?php get_footer();
