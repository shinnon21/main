<?php
/* 404（設計書 §5.12） */
get_header();
?>
<div class="notfound">
	<div class="code en">404</div>
	<p><?php echo wp_kses( kb_t( 'お探しのページは見つかりませんでした。<br>移動または削除された可能性があります。', 'The page you are looking for could not be found.<br>It may have been moved or deleted.' ), array( 'br' => array() ) ); ?></p>
	<div class="links">
		<a class="btn primary" href="<?php echo esc_url( kb_home( '/' ) ); ?>"><?php echo esc_html( kb_t( 'トップへ戻る', 'Back to top' ) ); ?></a>
		<a class="btn ghost" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>"><?php echo esc_html( kb_t( '実績一覧', 'Works' ) ); ?></a>
		<a class="btn ghost" href="<?php echo esc_url( kb_home( '/searches/' ) ); ?>"><?php echo esc_html( kb_t( '条件から探す', 'Advanced search' ) ); ?></a>
	</div>
</div>
<?php get_footer(); ?>
