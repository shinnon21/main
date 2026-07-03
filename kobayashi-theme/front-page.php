<?php
/* トップページ（設計書 §5.3 / デザインカンプ準拠） */
get_header();
?>

<!-- 1. ヒーロー -->
<section class="hero">
	<div class="hero-bg"></div>
	<div class="container">
		<div>
			<p class="lbl">POLITICS × TECHNOLOGY × SOCIAL DESIGN</p>
			<h1>構想を、<br><span class="u">社会に実装する。</span></h1>
			<p class="lead">政治・行政のDX支援から、医薬品サプライチェーンの研究まで。「日本の技術を社会に届けるコーディネーター」を志す、小林慎之助のポートフォリオサイトです。</p>
			<div class="cta">
				<a class="btn primary" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>">実績を見る →</a>
				<a class="btn ghost" href="<?php echo esc_url( home_url( '/profile/' ) ); ?>">プロフィール</a>
			</div>
		</div>
		<div class="hero-visual" aria-hidden="true">
			<svg viewBox="0 0 400 360" xmlns="http://www.w3.org/2000/svg">
				<defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C22740"/><stop offset="1" stop-color="#84192A"/></linearGradient></defs>
				<g fill="none" stroke="#84192A" stroke-opacity=".14" stroke-width="1.2">
					<path d="M0 60 C 120 20, 280 100, 400 60"/><path d="M0 120 C 120 80, 280 160, 400 120"/><path d="M0 180 C 120 140, 280 220, 400 180"/><path d="M0 240 C 120 200, 280 280, 400 240"/><path d="M0 300 C 120 260, 280 340, 400 300"/>
					<path d="M60 0 C 20 120, 100 240, 60 360"/><path d="M140 0 C 100 120, 180 240, 140 360"/><path d="M220 0 C 180 120, 260 240, 220 360"/><path d="M300 0 C 260 120, 340 240, 300 360"/>
				</g>
				<g>
					<circle cx="140" cy="118" r="7" fill="url(#lg1)"/><circle cx="300" cy="180" r="10" fill="#C22740"/><circle cx="220" cy="240" r="5" fill="#84192A"/><circle cx="80" cy="260" r="6" fill="#C22740" fill-opacity=".55"/><circle cx="330" cy="80" r="4" fill="#84192A" fill-opacity=".5"/>
					<path d="M140 118 L300 180 L220 240 L80 260" stroke="#C22740" stroke-width="1.6" stroke-opacity=".5" fill="none"/>
				</g>
			</svg>
		</div>
	</div>
</section>

<!-- 2. キーワードティッカー -->
<?php
$skills = get_terms( array( 'taxonomy' => 'skill', 'number' => 14, 'orderby' => 'count', 'order' => 'DESC' ) );
if ( $skills && ! is_wp_error( $skills ) ) : ?>
<div class="ticker">
	<div class="lane" id="tickerLane">
		<?php foreach ( $skills as $t ) : ?>
		<a href="<?php echo esc_url( get_term_link( $t ) ); ?>"># <?php echo esc_html( $t->name ); ?></a>
		<?php endforeach; ?>
	</div>
</div>
<?php endif; ?>

<!-- 3. 注目実績 -->
<?php
$featured = new WP_Query( array(
	'post_type'      => 'works',
	'posts_per_page' => 4,
	'meta_query'     => array( array( 'key' => 'is_featured', 'value' => '1' ) ),
) );
if ( ! $featured->have_posts() ) {
	$featured = new WP_Query( array( 'post_type' => 'works', 'posts_per_page' => 4 ) );
}
if ( $featured->have_posts() ) : ?>
<section class="sec">
	<div class="container">
		<div class="sec-head">
			<div class="l"><p class="lbl">featured works</p><h2>注目の実績</h2></div>
			<a class="more" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>">実績一覧を見る →</a>
		</div>
		<div class="featured">
			<?php $i = 0; while ( $featured->have_posts() ) : $featured->the_post(); $i++; ?>
				<?php if ( 1 === $i ) : ?>
				<a class="card main" href="<?php the_permalink(); ?>">
					<?php kb_thumb(); ?>
					<div class="body">
						<div class="meta"><?php kb_type_badge(); ?><?php kb_works_period(); ?></div>
						<h3><?php the_title(); ?></h3>
						<?php if ( has_excerpt() ) : ?><p class="desc"><?php echo esc_html( get_the_excerpt() ); ?></p><?php endif; ?>
						<?php kb_skill_chips( 3, false ); ?>
					</div>
				</a>
				<div class="f-side">
				<?php else : ?>
					<a class="card" href="<?php the_permalink(); ?>">
						<?php kb_thumb(); ?>
						<div class="body"><div class="meta"><?php kb_type_badge(); ?></div><h3><?php the_title(); ?></h3></div>
					</a>
				<?php endif; ?>
			<?php endwhile; ?>
			</div>
		</div>
	</div>
</section>
<?php endif; wp_reset_postdata(); ?>

<!-- 4. 新着実績 -->
<?php $new_works = new WP_Query( array( 'post_type' => 'works', 'posts_per_page' => 6 ) );
if ( $new_works->have_posts() ) : ?>
<section class="sec" style="padding-top:0">
	<div class="container">
		<div class="sec-head">
			<div class="l"><p class="lbl">works</p><h2>新着実績</h2></div>
			<a class="more" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>">すべて見る →</a>
		</div>
		<div class="grid3">
			<?php while ( $new_works->have_posts() ) : $new_works->the_post(); get_template_part( 'parts/card', 'works' ); endwhile; ?>
		</div>
		<div class="center-btn"><a class="btn ghost" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>">実績一覧を見る →</a></div>
	</div>
</section>
<?php endif; wp_reset_postdata(); ?>

<!-- 5. 新着コラム＋ランキング -->
<?php $cols = new WP_Query( array( 'post_type' => 'column', 'posts_per_page' => 4 ) );
if ( $cols->have_posts() ) : ?>
<section class="sec" style="background:#fff">
	<div class="container col-wrap">
		<div>
			<div class="sec-head">
				<div class="l"><p class="lbl">column</p><h2>新着コラム</h2></div>
				<a class="more" href="<?php echo esc_url( get_post_type_archive_link( 'column' ) ); ?>">コラム一覧へ →</a>
			</div>
			<?php while ( $cols->have_posts() ) : $cols->the_post(); get_template_part( 'parts/card', 'column' ); endwhile; wp_reset_postdata(); ?>
		</div>
		<aside><?php get_template_part( 'parts/side-ranking' ); ?></aside>
	</div>
</section>
<?php endif; ?>

<!-- 6. お知らせ -->
<?php $news = new WP_Query( array( 'post_type' => 'news', 'posts_per_page' => 3 ) );
if ( $news->have_posts() ) : ?>
<section class="sec">
	<div class="container">
		<div class="sec-head">
			<div class="l"><p class="lbl">news</p><h2>お知らせ</h2></div>
			<a class="more" href="<?php echo esc_url( get_post_type_archive_link( 'news' ) ); ?>">一覧へ →</a>
		</div>
		<div class="news-list">
			<?php while ( $news->have_posts() ) : $news->the_post(); ?>
			<a class="news-item" href="<?php the_permalink(); ?>">
				<span class="d"><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></span>
				<span class="badge">お知らせ</span>
				<span class="t"><?php the_title(); ?></span>
			</a>
			<?php endwhile; wp_reset_postdata(); ?>
		</div>
	</div>
</section>
<?php endif; ?>

<!-- 8. プロフィールダイジェスト -->
<section class="sec" style="padding-top:0">
	<div class="container">
		<div class="prof">
			<div class="avatar"><span class="init">SK</span></div>
			<div>
				<p class="kana">こばやし しんのすけ</p>
				<h2>小林 慎之助</h2>
				<p class="role">Weeave株式会社 共同創業者・代表取締役 CEO ／ 筑波大学 理工学群 社会工学類 経営工学主専攻</p>
				<p>筑波大学で経営工学を学びながら、政治・行政・企業のDXと社会課題の解決に取り組む学生起業家。データドリブンな戦略立案とコミュニティ構築を強みに、「構想で終わらせず、現場で使われる仕組みとして社会に実装する」ことにこだわり続けています。</p>
				<div class="p-cta">
					<a class="btn primary" href="<?php echo esc_url( home_url( '/profile/' ) ); ?>">プロフィール詳細 →</a>
					<a class="btn ghost" href="<?php echo esc_url( home_url( '/profile/#research' ) ); ?>">研究テーマを見る</a>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- 9. お問い合わせCTA -->
<section class="sec" style="padding-top:0">
	<div class="container">
		<div class="contact-cta">
			<p class="lbl">contact</p>
			<h2>お仕事のご相談・採用に関するご連絡</h2>
			<p>DX支援・データ分析・事業開発のご相談、採用・協業のお声がけはお問い合わせフォームからお願いします。</p>
			<a class="btn white" href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">お問い合わせ →</a>
		</div>
	</div>
</section>

<?php get_footer(); ?>
