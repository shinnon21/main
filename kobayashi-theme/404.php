<?php
/* 404（設計書 §5.12） */
get_header();
?>
<div class="notfound">
	<div class="code en">404</div>
	<p>お探しのページは見つかりませんでした。<br>移動または削除された可能性があります。</p>
	<div class="links">
		<a class="btn primary" href="<?php echo esc_url( home_url( '/' ) ); ?>">トップへ戻る</a>
		<a class="btn ghost" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>">実績一覧</a>
		<a class="btn ghost" href="<?php echo esc_url( home_url( '/searches/' ) ); ?>">条件から探す</a>
	</div>
</div>
<?php get_footer(); ?>
