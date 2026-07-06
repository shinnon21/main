<?php
/* 実績詳細（設計書 §5.5） */
get_header();
while ( have_posts() ) : the_post();
?>
<div class="sec">
	<div class="container" style="max-width:900px">
		<?php kb_breadcrumbs(); ?>

		<article class="entry-wrap" style="margin-top:18px;max-width:none">
			<header class="entry-head">
				<div class="meta"><?php kb_type_badge(); ?><?php kb_dates(); ?></div>
				<h1><?php kb_the_title(); ?></h1>
				<?php $kb_sf = kb_get_excerpt(); if ( $kb_sf ) : ?><p class="standfirst"><?php echo esc_html( $kb_sf ); ?></p><?php endif; ?>
				<?php kb_skill_chips( 6 ); ?>
			</header>

			<?php if ( has_post_thumbnail() ) : ?>
			<div class="entry-thumb"><?php the_post_thumbnail( 'large' ); ?></div>
			<?php endif; ?>

			<?php /* 概要グリッド（ACFフィールド：設計書 §6.3） */
			$client = kb_field_i18n( 'client_name' );
			$role   = kb_field_i18n( 'role' );
			$scope  = kb_field( 'scope' );
			$tech   = kb_field_i18n( 'tech_stack' );
			$url    = kb_field( 'site_url' );
			$inds   = get_the_terms( get_the_ID(), 'industry' );
			if ( $client || $role || $tech || $scope || $url || kb_field( 'period_start' ) ) : ?>
			<dl class="ov">
				<?php if ( $client ) : ?><div class="ov-item"><dt><?php echo esc_html( kb_t( 'クライアント', 'Client' ) ); ?></dt><dd><?php echo esc_html( $client ); ?></dd></div><?php endif; ?>
				<?php if ( $inds && ! is_wp_error( $inds ) ) : ?><div class="ov-item"><dt><?php echo esc_html( kb_t( '業界', 'Industry' ) ); ?></dt><dd><?php echo esc_html( implode( kb_t( '／', ' / ' ), array_map( 'kb_term_en', wp_list_pluck( $inds, 'name' ) ) ) ); ?></dd></div><?php endif; ?>
				<?php if ( kb_field( 'period_start' ) ) : ?><div class="ov-item"><dt><?php echo esc_html( kb_t( '期間', 'Period' ) ); ?></dt><dd><?php kb_works_period(); ?></dd></div><?php endif; ?>
				<?php if ( $role ) : ?><div class="ov-item"><dt><?php echo esc_html( kb_t( '役割', 'Role' ) ); ?></dt><dd><?php echo esc_html( $role ); ?></dd></div><?php endif; ?>
				<?php if ( $scope ) : ?><div class="ov-item"><dt><?php echo esc_html( kb_t( '担当領域', 'Scope' ) ); ?></dt><dd><?php echo esc_html( is_array( $scope ) ? implode( kb_t( '／', ' / ' ), array_map( 'kb_scope_label', $scope ) ) : kb_scope_label( $scope ) ); ?></dd></div><?php endif; ?>
				<?php if ( $tech ) : ?><div class="ov-item"><dt><?php echo esc_html( kb_t( '使用技術', 'Tech & Tools' ) ); ?></dt><dd><?php echo esc_html( $tech ); ?></dd></div><?php endif; ?>
				<?php if ( $url ) : ?><div class="ov-item"><dt><?php echo esc_html( kb_t( 'ウェブサイト', 'Website' ) ); ?></dt><dd><a class="ov-link" href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener"><?php echo esc_html( preg_replace( '~^https?://(www\.)?|/$~', '', $url ) ); ?> ↗</a></dd></div><?php endif; ?>
			</dl>
			<?php endif; ?>

			<div class="entry-content"><?php kb_the_content(); ?></div>

			<?php /* 数値成果（ACFリピーター kpi_results: label / value ） */
			$kpis = kb_field_i18n( 'kpi_results' );
			if ( is_array( $kpis ) && $kpis ) : ?>
			<div class="blk-head"><span class="en">outcome</span><h2><?php echo esc_html( kb_t( '数値で見る成果', 'Key Results' ) ); ?></h2></div>
			<div class="kpi-grid">
				<?php foreach ( $kpis as $k ) : if ( empty( $k['value'] ) ) { continue; } ?>
				<div class="kpi"><div class="v"><?php echo esc_html( $k['value'] ); ?></div><div class="l"><?php echo esc_html( $k['label'] ); ?></div></div>
				<?php endforeach; ?>
			</div>
			<?php endif; ?>

			<?php /* ギャラリー（ACF gallery） */
			$gallery = kb_field( 'gallery' );
			if ( is_array( $gallery ) && $gallery ) : ?>
			<div class="blk-head"><span class="en">gallery</span><h2><?php echo esc_html( kb_t( 'ギャラリー', 'Gallery' ) ); ?></h2></div>
			<div class="gallery-grid">
				<?php foreach ( $gallery as $img ) :
					$src = is_array( $img ) ? ( isset( $img['sizes']['medium_large'] ) ? $img['sizes']['medium_large'] : $img['url'] ) : wp_get_attachment_image_url( (int) $img, 'medium_large' );
					if ( $src ) : ?>
				<img src="<?php echo esc_url( $src ); ?>" alt="">
				<?php endif; endforeach; ?>
			</div>
			<?php endif; ?>

			<?php /* シェア（F-08） */ ?>
			<?php kb_share_buttons(); ?>

			<div class="entry-cta">
				<p class="lbl">contact</p>
				<h2><?php echo esc_html( kb_t( 'この実績について相談する', 'Discuss this project' ) ); ?></h2>
				<p><?php echo esc_html( kb_t( 'ご相談・詳細のご質問はお気軽にどうぞ。', 'Questions and consultation requests are always welcome.' ) ); ?></p>
				<a class="btn primary" href="<?php echo esc_url( kb_home( '/contact/' ) ); ?>"><?php echo esc_html( kb_t( 'お問い合わせフォームへ →', 'Go to contact form →' ) ); ?></a>
				<a class="btn ghost" href="<?php echo esc_url( kb_home( '/profile/' ) ); ?>"><?php echo esc_html( kb_t( 'プロフィールを見る', 'View profile' ) ); ?></a>
			</div>
		</article>

		<?php /* 関連実績（F-07：同じ実績種別から3件） */
		$types = get_the_terms( get_the_ID(), 'works_type' );
		if ( $types && ! is_wp_error( $types ) ) :
			$related = new WP_Query( array(
				'post_type'      => 'works',
				'posts_per_page' => 3,
				'post__not_in'   => array( get_the_ID() ),
				'tax_query'      => array( array( 'taxonomy' => 'works_type', 'field' => 'term_id', 'terms' => wp_list_pluck( $types, 'term_id' ) ) ),
			) );
			if ( $related->have_posts() ) : ?>
		<section style="margin-top:56px">
			<div class="sec-head"><div class="l"><p class="lbl">related</p><h2><?php echo esc_html( kb_t( '関連実績', 'Related Works' ) ); ?></h2></div></div>
			<div class="grid3">
				<?php while ( $related->have_posts() ) : $related->the_post(); get_template_part( 'parts/card', 'works' ); endwhile; wp_reset_postdata(); ?>
			</div>
		</section>
		<?php endif; endif; ?>

	</div>
</div>
<?php endwhile; get_footer(); ?>
