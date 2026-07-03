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
				<div class="meta"><?php kb_dates(); ?><?php kb_type_badge(); ?></div>
				<h1><?php the_title(); ?></h1>
				<?php kb_skill_chips( 6 ); ?>
			</header>

			<?php if ( has_post_thumbnail() ) : ?>
			<div class="entry-thumb"><?php the_post_thumbnail( 'large' ); ?></div>
			<?php endif; ?>

			<?php /* 概要テーブル（ACFフィールド：設計書 §6.3） */
			$client = kb_field( 'client_name' );
			$role   = kb_field( 'role' );
			$scope  = kb_field( 'scope' );
			$tech   = kb_field( 'tech_stack' );
			$url    = kb_field( 'site_url' );
			$inds   = get_the_terms( get_the_ID(), 'industry' );
			if ( $client || $role || $tech ) : ?>
			<table class="spec">
				<?php if ( $client ) : ?><tr><th>クライアント</th><td><?php echo esc_html( $client ); ?></td></tr><?php endif; ?>
				<?php if ( $inds && ! is_wp_error( $inds ) ) : ?><tr><th>業界</th><td><?php echo esc_html( implode( '／', wp_list_pluck( $inds, 'name' ) ) ); ?></td></tr><?php endif; ?>
				<tr><th>期間</th><td><?php kb_works_period(); ?></td></tr>
				<?php if ( $role ) : ?><tr><th>役割</th><td><?php echo esc_html( $role ); ?></td></tr><?php endif; ?>
				<?php if ( $scope ) : ?><tr><th>担当範囲</th><td><?php echo esc_html( is_array( $scope ) ? implode( '／', $scope ) : $scope ); ?></td></tr><?php endif; ?>
				<?php if ( $tech ) : ?><tr><th>使用技術</th><td><?php echo esc_html( $tech ); ?></td></tr><?php endif; ?>
				<?php if ( $url ) : ?><tr><th>URL</th><td><a href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener" style="color:var(--crimson)"><?php echo esc_html( $url ); ?> ↗</a></td></tr><?php endif; ?>
			</table>
			<?php endif; ?>

			<div class="entry-content"><?php the_content(); ?></div>

			<?php /* 数値成果（ACFリピーター kpi_results: label / value ） */
			$kpis = kb_field( 'kpi_results' );
			if ( is_array( $kpis ) && $kpis ) : ?>
			<div class="kpi-grid">
				<?php foreach ( $kpis as $k ) : if ( empty( $k['value'] ) ) { continue; } ?>
				<div class="kpi"><div class="v"><?php echo esc_html( $k['value'] ); ?></div><div class="l"><?php echo esc_html( $k['label'] ); ?></div></div>
				<?php endforeach; ?>
			</div>
			<?php endif; ?>

			<?php /* ギャラリー（ACF gallery） */
			$gallery = kb_field( 'gallery' );
			if ( is_array( $gallery ) && $gallery ) : ?>
			<div class="gallery-grid">
				<?php foreach ( $gallery as $img ) :
					$src = is_array( $img ) ? ( isset( $img['sizes']['medium_large'] ) ? $img['sizes']['medium_large'] : $img['url'] ) : wp_get_attachment_image_url( (int) $img, 'medium_large' );
					if ( $src ) : ?>
				<img src="<?php echo esc_url( $src ); ?>" alt="">
				<?php endif; endforeach; ?>
			</div>
			<?php endif; ?>

			<?php /* シェア（F-08） */
			$share_url   = rawurlencode( get_permalink() );
			$share_title = rawurlencode( get_the_title() ); ?>
			<div class="share">
				<span class="s-lbl">SHARE</span>
				<a href="https://x.com/intent/tweet?url=<?php echo $share_url; ?>&text=<?php echo $share_title; ?>" target="_blank" rel="noopener">X</a>
				<a href="https://www.facebook.com/sharer/sharer.php?u=<?php echo $share_url; ?>" target="_blank" rel="noopener">Facebook</a>
				<a href="https://b.hatena.ne.jp/entry/<?php echo esc_url( get_permalink() ); ?>" target="_blank" rel="noopener">はてな</a>
				<button type="button" class="js-copy-url">URLコピー</button>
			</div>

			<div class="entry-cta">
				<p>この実績に関するご相談・詳細のご質問はお気軽にどうぞ。</p>
				<a class="btn primary" href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">この実績について問い合わせる</a>
				<a class="btn ghost" href="<?php echo esc_url( home_url( '/profile/' ) ); ?>">プロフィールを見る</a>
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
			<div class="sec-head"><div class="l"><p class="lbl">related</p><h2>関連実績</h2></div></div>
			<div class="grid3">
				<?php while ( $related->have_posts() ) : $related->the_post(); get_template_part( 'parts/card', 'works' ); endwhile; wp_reset_postdata(); ?>
			</div>
		</section>
		<?php endif; endif; ?>

	</div>
</div>
<?php endwhile; get_footer(); ?>
