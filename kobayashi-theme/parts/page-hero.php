<?php
/* 下層ページ共通MV＋パンくず
   使い方: get_template_part( 'parts/page-hero', null, array( 'label' => 'works', 'title' => '実績' ) ); */
$label = isset( $args['label'] ) ? $args['label'] : '';
$title = isset( $args['title'] ) ? $args['title'] : get_the_title();
?>
<div class="page-mv" data-en="<?php echo esc_attr( $label ); ?>">
	<div class="container">
		<p class="lbl"><?php echo esc_html( $label ); ?></p>
		<h1><?php echo esc_html( $title ); ?></h1>
		<?php kb_breadcrumbs(); ?>
	</div>
</div>
