<?php
/**
 * Template Name: 資料ダウンロード
 * 設計書 §5.9（Phase 1: 直接DL）
 */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'document', 'title' => '資料ダウンロード' ) );

$docs = new WP_Query( array( 'post_type' => 'document', 'posts_per_page' => -1 ) );
?>
<div class="sec">
	<div class="container">
		<?php if ( $docs->have_posts() ) : ?>
		<div class="doc-grid">
			<?php while ( $docs->have_posts() ) : $docs->the_post();
				$file = kb_field( 'file' );
				$file_url = is_array( $file ) ? ( isset( $file['url'] ) ? $file['url'] : '' ) : ( is_numeric( $file ) ? wp_get_attachment_url( (int) $file ) : $file );
			?>
			<div class="doc-card">
				<?php if ( has_post_thumbnail() ) : ?>
					<div style="margin:0 auto 18px;max-width:120px"><?php the_post_thumbnail( 'medium' ); ?></div>
				<?php else : ?>
					<div class="doc"><i></i><i></i><i></i><i></i><i style="width:70%"></i></div>
				<?php endif; ?>
				<h3><?php the_title(); ?></h3>
				<p><?php echo esc_html( wp_strip_all_tags( get_the_content() ) ); ?></p>
				<?php if ( $file_url ) : ?>
				<a class="btn primary sm" href="<?php echo esc_url( $file_url ); ?>" download>ダウンロード（PDF）</a>
				<?php endif; ?>
			</div>
			<?php endwhile; wp_reset_postdata(); ?>
		</div>
		<?php else : ?>
		<p>公開中の資料はまだありません。管理画面の「DL資料」から追加し、カスタムフィールド「file」にPDFを設定してください。</p>
		<?php endif; ?>

		<div class="contact-cta" style="margin-top:56px">
			<p class="lbl">contact</p>
			<h2>資料に関するお問い合わせ</h2>
			<p>掲載内容の詳細や、記載のない実績についてはお気軽にお問い合わせください。</p>
			<a class="btn white" href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">お問い合わせ →</a>
		</div>
	</div>
</div>
<?php get_footer(); ?>
