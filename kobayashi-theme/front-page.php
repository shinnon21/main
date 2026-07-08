<?php
/* トップページ（設計書 §5.3 / デザインカンプ準拠） */
get_header();
?>

<!-- 1. ヒーロー -->
<section class="hero">
	<div class="hero-bg"></div>
	<div class="hero-visual" aria-hidden="true">
		<?php /* ファーストビュー全面の背景格子。波アニメ＋クリックでポイント追加は assets/main.js（#heroNet）が制御。
		         静的パスは no-JS／reduced-motion 時のフォールバック（1280×720想定。JSが実アスペクト比でviewBoxごと再生成する） */ ?>
		<svg id="heroNet" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
			<defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C22740"/><stop offset="1" stop-color="#84192A"/></linearGradient></defs>
			<g id="heroWaves" fill="none" stroke="#84192A" stroke-opacity=".14" stroke-width="1.2">
				<path d="M-20 -16 C 427 -56, 853 24, 1300 -16"/><path d="M-20 78 C 427 38, 853 118, 1300 78"/><path d="M-20 172 C 427 132, 853 212, 1300 172"/><path d="M-20 266 C 427 226, 853 306, 1300 266"/><path d="M-20 360 C 427 320, 853 400, 1300 360"/><path d="M-20 454 C 427 414, 853 494, 1300 454"/><path d="M-20 548 C 427 508, 853 588, 1300 548"/><path d="M-20 642 C 427 602, 853 682, 1300 642"/><path d="M-20 736 C 427 696, 853 776, 1300 736"/>
				<path d="M-16 -20 C -56 240, 24 480, -16 740"/><path d="M78 -20 C 38 240, 118 480, 78 740"/><path d="M171 -20 C 131 240, 211 480, 171 740"/><path d="M265 -20 C 225 240, 305 480, 265 740"/><path d="M359 -20 C 319 240, 399 480, 359 740"/><path d="M453 -20 C 413 240, 493 480, 453 740"/><path d="M546 -20 C 506 240, 586 480, 546 740"/><path d="M640 -20 C 600 240, 680 480, 640 740"/><path d="M734 -20 C 694 240, 774 480, 734 740"/><path d="M827 -20 C 787 240, 867 480, 827 740"/><path d="M921 -20 C 881 240, 961 480, 921 740"/><path d="M1015 -20 C 975 240, 1055 480, 1015 740"/><path d="M1109 -20 C 1069 240, 1149 480, 1109 740"/><path d="M1202 -20 C 1162 240, 1242 480, 1202 740"/><path d="M1296 -20 C 1256 240, 1336 480, 1296 740"/>
			</g>
			<g id="heroLinks">
				<path d="M90 86 L282 50 L512 79 L384 122" stroke="#C22740" stroke-width="1.6" stroke-opacity=".5" fill="none"/>
			</g>
			<g id="heroDots">
				<circle cx="90" cy="86" r="7" fill="url(#lg1)"/><circle cx="282" cy="50" r="10" fill="#C22740"/><circle cx="512" cy="79" r="5" fill="#84192A"/><circle cx="384" cy="122" r="6" fill="#C22740" fill-opacity=".55"/><circle cx="115" cy="648" r="4" fill="#84192A" fill-opacity=".5"/>
			</g>
			<circle id="heroCursor" r="6" fill="#C22740" fill-opacity=".3" style="display:none"/>
		</svg>
	</div>
	<div class="container">
		<div>
			<p class="lbl">POLITICS × TECHNOLOGY × SOCIAL DESIGN</p>
			<h1><?php echo wp_kses_post( kb_t( '構想を、<br><span class="u">社会に実装する。</span>', 'Vision,<br><span class="u">implemented in society.</span>' ) ); ?></h1>
			<p class="lead"><?php echo esc_html( kb_t( '政治・行政のDX支援から、医薬品サプライチェーンの研究まで。「日本の技術を社会に届けるコーディネーター」を志す、小林慎之助の公式サイトです。', 'From DX support for politics and government to research on pharmaceutical supply chains — the official website of Shinnosuke Kobayashi, an aspiring coordinator who delivers Japanese technology to society.' ) ); ?></p>
			<div class="cta">
				<a class="btn primary" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>"><?php echo esc_html( kb_t( '実績を見る →', 'View works →' ) ); ?></a>
				<a class="btn ghost" href="<?php echo esc_url( kb_home( '/profile/' ) ); ?>"><?php echo esc_html( kb_t( 'プロフィール', 'Profile' ) ); ?></a>
			</div>
		</div>
		<div class="hero-photo">
			<img src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/kobayashi-hero.webp?v=' . wp_get_theme()->get( 'Version' ) ); ?>" alt="<?php echo esc_attr( kb_t( '小林慎之助', 'Shinnosuke Kobayashi' ) ); ?>" width="780" height="1135" loading="eager" fetchpriority="high">
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
		<a href="<?php echo esc_url( get_term_link( $t ) ); ?>"># <?php echo esc_html( kb_term_en( $t->name ) ); ?></a>
		<?php endforeach; ?>
	</div>
</div>
<?php endif; ?>

<!-- 3. 主な実績 -->
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
			<div class="l"><p class="lbl">selected works</p><h2><?php echo esc_html( kb_t( '主な実績', 'Selected Works' ) ); ?></h2></div>
			<a class="more" href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>"><?php echo esc_html( kb_t( '実績一覧を見る →', 'All works →' ) ); ?></a>
		</div>
		<div class="featured">
			<?php $i = 0; while ( $featured->have_posts() ) : $featured->the_post(); $i++; ?>
				<?php if ( 1 === $i ) : ?>
				<a class="card main" href="<?php the_permalink(); ?>">
					<?php kb_thumb(); ?>
					<div class="body">
						<div class="meta"><?php kb_type_badge(); ?><?php kb_works_period(); ?></div>
						<h3><?php kb_the_title(); ?></h3>
						<?php $kb_d = kb_get_excerpt(); if ( $kb_d ) : ?><p class="desc"><?php echo esc_html( $kb_d ); ?></p><?php endif; ?>
						<?php kb_skill_chips( 3, false ); ?>
					</div>
				</a>
				<div class="f-side">
				<?php else : ?>
					<a class="card" href="<?php the_permalink(); ?>">
						<?php kb_thumb(); ?>
						<div class="body"><div class="meta"><?php kb_type_badge(); ?></div><h3><?php kb_the_title(); ?></h3></div>
					</a>
				<?php endif; ?>
			<?php endwhile; ?>
			</div>
		</div>
	</div>
</section>
<?php endif; wp_reset_postdata(); ?>

<!-- 4. お知らせ -->
<?php $news = new WP_Query( array( 'post_type' => 'news', 'posts_per_page' => 3 ) );
if ( $news->have_posts() ) : ?>
<section class="sec" style="padding-top:0">
	<div class="container">
		<div class="sec-head">
			<div class="l"><p class="lbl">news</p><h2><?php echo esc_html( kb_t( 'お知らせ', 'News' ) ); ?></h2></div>
			<a class="more" href="<?php echo esc_url( get_post_type_archive_link( 'news' ) ); ?>"><?php echo esc_html( kb_t( 'お知らせ一覧へ →', 'All news →' ) ); ?></a>
		</div>
		<div class="news-list">
			<?php while ( $news->have_posts() ) : $news->the_post(); ?>
			<a class="news-item" href="<?php the_permalink(); ?>">
				<span class="d"><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></span>
				<?php kb_news_type_badge(); ?>
				<span class="t"><?php kb_the_title(); ?></span>
			</a>
			<?php endwhile; wp_reset_postdata(); ?>
		</div>
	</div>
</section>
<?php endif; ?>

<!-- 5. 新着コラム＋ランキング -->
<?php $cols = new WP_Query( array( 'post_type' => 'column', 'posts_per_page' => 4 ) );
if ( $cols->have_posts() ) : ?>
<section class="sec" style="background:#fff">
	<div class="container col-wrap">
		<div>
			<div class="sec-head">
				<div class="l"><p class="lbl">column</p><h2><?php echo esc_html( kb_t( '新着コラム', 'Latest Columns' ) ); ?></h2></div>
				<a class="more" href="<?php echo esc_url( get_post_type_archive_link( 'column' ) ); ?>"><?php echo esc_html( kb_t( 'コラム一覧へ →', 'All columns →' ) ); ?></a>
			</div>
			<?php while ( $cols->have_posts() ) : $cols->the_post(); get_template_part( 'parts/card', 'column' ); endwhile; wp_reset_postdata(); ?>
		</div>
		<aside><?php get_template_part( 'parts/side-ranking' ); ?></aside>
	</div>
</section>
<?php endif; ?>

<!-- 6. プロフィールダイジェスト -->
<section class="sec">
	<div class="container">
		<div class="prof">
			<?php kb_avatar(); ?>
			<div>
				<p class="kana"><?php echo esc_html( kb_profile_field( 'profile_kana' ) ); ?></p>
				<h2><?php echo esc_html( kb_profile_field( 'profile_name' ) ); ?></h2>
				<p class="role"><?php echo esc_html( kb_profile_field( 'profile_role' ) ); ?></p>
				<p><?php echo esc_html( kb_t( '筑波大学で経営工学を学びながら、政治・行政・企業のDXと社会課題の解決に取り組む学生起業家。データドリブンな戦略立案とコミュニティ構築を強みに、「構想で終わらせず、現場で使われる仕組みとして社会に実装する」ことにこだわり続けています。', 'A student entrepreneur studying management science and engineering at the University of Tsukuba while working on DX and social challenges across politics, government, and business. With strengths in data-driven strategy and community building, I am committed to implementing ideas as systems that actually work in the field — not leaving them as concepts.' ) ); ?></p>
				<div class="p-cta">
					<a class="btn primary" href="<?php echo esc_url( kb_home( '/profile/' ) ); ?>"><?php echo esc_html( kb_t( 'プロフィール詳細 →', 'Full profile →' ) ); ?></a>
					<a class="btn ghost" href="<?php echo esc_url( kb_home( '/profile/#research' ) ); ?>"><?php echo esc_html( kb_t( '研究テーマを見る', 'Research theme' ) ); ?></a>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- 7. お問い合わせCTA -->
<section class="sec" style="padding-top:0">
	<div class="container">
		<div class="contact-cta">
			<p class="lbl">contact</p>
			<h2><?php echo esc_html( kb_t( 'お仕事のご相談・ご連絡', 'Work Inquiries' ) ); ?></h2>
			<p><?php echo esc_html( kb_t( 'DX支援・データ分析・事業開発のご相談、取材・登壇のご依頼、協業のお声がけなど、お問い合わせフォームからお気軽にご連絡ください。', 'For consulting on DX, data analysis, or business development, interview and speaking requests, or collaboration proposals — feel free to reach out via the contact form.' ) ); ?></p>
			<a class="btn white" href="<?php echo esc_url( kb_home( '/contact/' ) ); ?>"><?php echo esc_html( kb_t( 'お問い合わせ →', 'Contact →' ) ); ?></a>
		</div>
	</div>
</section>

<?php get_footer(); ?>
