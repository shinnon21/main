<?php
/* コラム詳細（設計書 §5.6） */
get_header();
while ( have_posts() ) : the_post();
?>
<div class="sec">
	<div class="container" style="max-width:900px">
		<?php kb_breadcrumbs(); ?>

		<article class="entry-wrap" style="margin-top:18px;max-width:none">
			<header class="entry-head">
				<div class="meta"><?php kb_dates(); ?><span class="badge accent" style="font-size:10px">コラム</span></div>
				<h1><?php the_title(); ?></h1>
				<?php kb_skill_chips( 6 ); ?>
			</header>

			<?php if ( has_post_thumbnail() ) : ?>
			<div class="entry-thumb"><?php the_post_thumbnail( 'large' ); ?></div>
			<?php endif; ?>

			<div class="entry-content"><?php the_content(); ?></div>

			<?php kb_share_buttons(); ?>

			<div class="author-box">
				<?php kb_avatar(); ?>
				<div>
					<div class="n"><?php echo esc_html( kb_profile_field( 'profile_name' ) ); ?></div>
					<div class="r"><?php echo esc_html( kb_profile_field( 'profile_role' ) ); ?></div>
					<p>政治・行政DXと社会実装をテーマに、実務と研究の両面から得た知見を発信しています。<a href="<?php echo esc_url( home_url( '/profile/' ) ); ?>" style="color:var(--crimson)">プロフィールを見る →</a></p>
				</div>
			</div>
		</article>

		<?php /* 関連記事：同じスキルタグから3件 */
		$skills = get_the_terms( get_the_ID(), 'skill' );
		if ( $skills && ! is_wp_error( $skills ) ) :
			$related = new WP_Query( array(
				'post_type'      => 'column',
				'posts_per_page' => 3,
				'post__not_in'   => array( get_the_ID() ),
				'tax_query'      => array( array( 'taxonomy' => 'skill', 'field' => 'term_id', 'terms' => wp_list_pluck( $skills, 'term_id' ) ) ),
			) );
			if ( $related->have_posts() ) : ?>
		<section style="margin-top:56px">
			<div class="sec-head"><div class="l"><p class="lbl">related</p><h2>関連記事</h2></div></div>
			<?php while ( $related->have_posts() ) : $related->the_post(); get_template_part( 'parts/card', 'column' ); endwhile; wp_reset_postdata(); ?>
		</section>
		<?php endif; endif; ?>

	</div>
</div>
<?php endwhile; get_footer(); ?>
