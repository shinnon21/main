<?php /* サイドバー：人気ランキング（F-03） */
$rank = kb_ranking( 5 );
if ( $rank->have_posts() ) : ?>
<div class="side-box">
	<div class="sb-head"><span class="lbl">ranking</span><h3><?php echo esc_html( kb_t( '人気コンテンツ', 'Popular' ) ); ?></h3></div>
	<?php $i = 0; while ( $rank->have_posts() ) : $rank->the_post(); $i++; ?>
	<a class="rank-item" href="<?php the_permalink(); ?>"><span class="no"><?php echo (int) $i; ?></span><?php kb_the_title(); ?></a>
	<?php endwhile; wp_reset_postdata(); ?>
</div>
<?php endif; ?>
