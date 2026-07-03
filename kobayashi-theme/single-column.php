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

			<?php $share_url = rawurlencode( get_permalink() ); $share_title = rawurlencode( get_the_title() ); ?>
			<div class="share">
				<span class="s-lbl">SHARE</span>
				<a href="https://x.com/intent/tweet?url=<?php echo $share_url; ?>&text=<?php echo $share_title; ?>" target="_blank" rel="noopener">X</a>
				<a href="https://www.facebook.com/sharer/sharer.php?u=<?php echo $share_url; ?>" target="_blank" rel="noopener">Facebook</a>
				<a href="https://b.hatena.ne.jp/entry/<?php echo esc_url( get_permalink() ); ?>" target="_blank" rel="noopener">はてな</a>
				<button type="button" class="js-copy-url">URLコピー</button>
			</div>

			<div class="author-box">
				<div class="avatar"><span class="init">SK</span></div>
				<div>
					<div class="n">小林 慎之助</div>
					<div class="r">Weeave株式会社 共同創業者・代表取締役 CEO ／ 筑波大学 経営工学主専攻</div>
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
