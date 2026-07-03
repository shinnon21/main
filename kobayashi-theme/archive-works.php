<?php
/* 実績一覧（設計書 §5.4）。taxonomy-works_type.php からも読み込まれる */
get_header();

$is_tax = is_tax( 'works_type' );
$title  = $is_tax ? single_term_title( '', false ) : '実績';
get_template_part( 'parts/page-hero', null, array( 'label' => 'works', 'title' => $title ) );
?>

<div class="sec">
	<div class="container">

		<?php /* キーワード絞り込み（skillタグ → 条件検索へ） */
		$skills = get_terms( array( 'taxonomy' => 'skill', 'number' => 12, 'orderby' => 'count', 'order' => 'DESC' ) );
		if ( $skills && ! is_wp_error( $skills ) ) : ?>
		<div class="filter-box" style="padding:22px 28px">
			<form method="get" action="<?php echo esc_url( home_url( '/searches/' ) ); ?>">
				<input type="hidden" name="types[]" value="works">
				<?php foreach ( $skills as $t ) : ?>
				<label class="check-pill"><input type="checkbox" name="skills[]" value="<?php echo esc_attr( $t->slug ); ?>"># <?php echo esc_html( $t->name ); ?></label>
				<?php endforeach; ?>
				<div class="filter-actions" style="margin-top:12px">
					<button type="submit" class="btn primary sm">条件から実績を探す</button>
					<a class="btn ghost sm" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>">条件をリセット</a>
				</div>
			</form>
		</div>
		<?php endif; ?>

		<div class="col-wrap">
			<div>
				<?php if ( have_posts() ) : ?>
				<div class="grid2">
					<?php while ( have_posts() ) : the_post(); get_template_part( 'parts/card', 'works' ); endwhile; ?>
				</div>
				<?php kb_pagination(); ?>
				<?php else : ?>
				<p>該当する実績はまだありません。</p>
				<?php endif; ?>
			</div>
			<aside>
				<?php get_template_part( 'parts/side-ranking' ); ?>
				<?php $all_skills = get_terms( array( 'taxonomy' => 'skill', 'hide_empty' => true ) );
				if ( $all_skills && ! is_wp_error( $all_skills ) ) : ?>
				<div class="side-box">
					<div class="sb-head"><span class="lbl">tags</span><h3>タグから探す</h3></div>
					<?php foreach ( $all_skills as $t ) : ?>
					<a class="chip" href="<?php echo esc_url( get_term_link( $t ) ); ?>"># <?php echo esc_html( $t->name ); ?></a>
					<?php endforeach; ?>
				</div>
				<?php endif; ?>
			</aside>
		</div>

	</div>
</div>

<?php get_footer(); ?>
