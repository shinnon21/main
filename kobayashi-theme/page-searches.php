<?php
/**
 * Template Name: 条件から探す
 * 条件検索（設計書 §5.7 / F-02）: kw × 期間 × 種別 × スキルタグ、公開順/更新順
 */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'search', 'title' => '条件から探す' ) );

/* ---- GETパラメータ ---- */
$kw     = isset( $_GET['kw'] ) ? sanitize_text_field( wp_unslash( $_GET['kw'] ) ) : '';
$from   = isset( $_GET['from'] ) ? sanitize_text_field( wp_unslash( $_GET['from'] ) ) : '';
$to     = isset( $_GET['to'] ) ? sanitize_text_field( wp_unslash( $_GET['to'] ) ) : '';
$types  = isset( $_GET['types'] ) ? array_intersect( (array) $_GET['types'], array( 'works', 'column', 'news' ) ) : array();
$sel_sk = isset( $_GET['skills'] ) ? array_map( 'sanitize_title', (array) $_GET['skills'] ) : array();
$sort   = ( isset( $_GET['sort'] ) && 'modified' === $_GET['sort'] ) ? 'modified' : 'date';
$did    = isset( $_GET['kw'] ) || isset( $_GET['types'] ) || isset( $_GET['skills'] ) || isset( $_GET['from'] );

/* ---- 選択肢 ---- */
$all_skills = get_terms( array( 'taxonomy' => 'skill', 'hide_empty' => true ) );
if ( is_wp_error( $all_skills ) ) { $all_skills = array(); }
$months = array();
/* 月初を起点に遡る（31日など月末に実行すると相対指定が翌月へ繰り上がり月が重複・欠落するため） */
$base = gmdate( 'Y-m-01' );
for ( $i = 0; $i < 48; $i++ ) { $months[] = gmdate( 'Y-m', strtotime( "{$base} -{$i} month" ) ); }
?>
<div class="sec">
	<div class="container">

		<form class="filter-box" method="get" action="">
			<div class="filter-row">
				<span class="f-lbl">フリーワード</span>
				<div class="f-body"><input type="text" name="kw" value="<?php echo esc_attr( $kw ); ?>" placeholder="キーワードを入力"></div>
			</div>
			<div class="filter-row">
				<span class="f-lbl">期間</span>
				<div class="f-body">
					<select name="from"><option value="">年月を選択</option>
						<?php foreach ( $months as $m ) : ?><option value="<?php echo esc_attr( $m ); ?>" <?php selected( $from, $m ); ?>><?php echo esc_html( str_replace( '-', '年', $m ) . '月' ); ?></option><?php endforeach; ?>
					</select>
					〜
					<select name="to"><option value="">年月を選択</option>
						<?php foreach ( $months as $m ) : ?><option value="<?php echo esc_attr( $m ); ?>" <?php selected( $to, $m ); ?>><?php echo esc_html( str_replace( '-', '年', $m ) . '月' ); ?></option><?php endforeach; ?>
					</select>
				</div>
			</div>
			<div class="filter-row">
				<span class="f-lbl">種別</span>
				<div class="f-body">
					<?php foreach ( array( 'works' => '実績', 'column' => 'コラム', 'news' => 'お知らせ' ) as $slug => $label ) : ?>
					<label class="check-pill"><input type="checkbox" name="types[]" value="<?php echo esc_attr( $slug ); ?>" <?php checked( in_array( $slug, $types, true ) ); ?>><?php echo esc_html( $label ); ?></label>
					<?php endforeach; ?>
				</div>
			</div>
			<div class="filter-row">
				<span class="f-lbl">キーワードタグ</span>
				<div class="f-body">
					<?php foreach ( $all_skills as $i => $t ) : $extra = $i >= 10 ? ' skill-extra' : ''; ?>
					<label class="check-pill<?php echo esc_attr( $extra ); ?>"><input type="checkbox" name="skills[]" value="<?php echo esc_attr( $t->slug ); ?>" <?php checked( in_array( $t->slug, $sel_sk, true ) ); ?>># <?php echo esc_html( $t->name ); ?></label>
					<?php endforeach; ?>
					<?php if ( count( $all_skills ) > 10 ) : ?>
					<div style="margin-top:6px"><button type="button" class="toggle-skills" id="toggleSkills">すべて表示する ▼</button></div>
					<?php endif; ?>
				</div>
			</div>
			<input type="hidden" name="sort" value="<?php echo esc_attr( $sort ); ?>">
			<div class="filter-actions">
				<button type="submit" class="btn primary">この条件で探す</button>
				<a class="btn ghost" href="<?php echo esc_url( get_permalink() ); ?>">条件をリセット</a>
			</div>
		</form>

		<?php if ( $did ) :
			/* ---- 検索クエリ構築 ---- */
			$paged = max( 1, get_query_var( 'paged' ), get_query_var( 'page' ) );
			$q_args = array(
				'post_type'      => $types ? array_values( $types ) : array( 'works', 'column', 'news' ),
				'posts_per_page' => 10,
				'paged'          => $paged,
				'orderby'        => $sort,
				'order'          => 'DESC',
			);
			if ( $kw ) { $q_args['s'] = $kw; }
			if ( $sel_sk ) {
				$q_args['tax_query'] = array( array( 'taxonomy' => 'skill', 'field' => 'slug', 'terms' => $sel_sk ) );
			}
			$date_q = array();
			if ( $from ) { $p = explode( '-', $from ); $date_q['after'] = array( 'year' => (int) $p[0], 'month' => (int) $p[1], 'day' => 1 ); }
			if ( $to )   { $p = explode( '-', $to );   $date_q['before'] = array( 'year' => (int) $p[0], 'month' => (int) $p[1], 'day' => 31 ); }
			if ( $date_q ) { $date_q['inclusive'] = true; $q_args['date_query'] = array( $date_q ); }

			$results = new WP_Query( $q_args );

			/* 並び順タブ用URL */
			$base_qs = $_GET; unset( $base_qs['sort'] );
			$url_date = esc_url( add_query_arg( array_merge( $base_qs, array( 'sort' => 'date' ) ), get_permalink() ) );
			$url_mod  = esc_url( add_query_arg( array_merge( $base_qs, array( 'sort' => 'modified' ) ), get_permalink() ) );
		?>
		<div class="sort-tabs">
			<a href="<?php echo $url_date; ?>" class="<?php echo 'date' === $sort ? 'on' : ''; ?>">公開順</a>
			<a href="<?php echo $url_mod; ?>" class="<?php echo 'modified' === $sort ? 'on' : ''; ?>">更新順</a>
		</div>
		<p class="result-count">全 <?php echo (int) $results->found_posts; ?> 件</p>

		<?php if ( $results->have_posts() ) : ?>
			<?php while ( $results->have_posts() ) : $results->the_post(); get_template_part( 'parts/card', 'column' ); endwhile; wp_reset_postdata(); ?>
			<?php
			/* GET条件を保持したページネーション */
			$links = paginate_links( array(
				'total'    => $results->max_num_pages,
				'current'  => $paged,
				'mid_size' => 1,
				'prev_text'=> '‹',
				'next_text'=> '›',
				'add_args' => array_map( function ( $v ) { return is_array( $v ) ? array_map( 'sanitize_text_field', $v ) : sanitize_text_field( $v ); }, $_GET ),
			) );
			if ( $links ) { echo '<div class="pagination"><div class="nav-links">' . $links . '</div></div>'; }
			?>
		<?php else : ?>
			<div class="notfound" style="padding:60px 24px">
				<p>条件に一致するコンテンツが見つかりませんでした。<br>条件を変えて再度お試しください。</p>
			</div>
			<?php get_template_part( 'parts/side-ranking' ); ?>
		<?php endif; ?>
		<?php endif; ?>

	</div>
</div>
<?php get_footer(); ?>
