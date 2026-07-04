<?php
/**
 * Template Name: プロフィール
 * 設計書 §5.8。経歴・スキル等は初期データを直書き（後で管理画面編集に移行可）
 */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'profile', 'title' => 'プロフィール' ) );
?>
<div class="sec">
	<div class="container" style="max-width:900px">

		<?php /* 以下の各セクションはWP管理画面（プロフィールページの「プロフィール編集」欄）から編集可能 */ ?>
		<div class="prof" style="margin-bottom:32px">
			<?php kb_avatar(); ?>
			<div>
				<p class="kana"><?php echo esc_html( kb_profile_field( 'profile_kana' ) ); ?></p>
				<h2><?php echo esc_html( kb_profile_field( 'profile_name' ) ); ?></h2>
				<p class="role"><?php echo esc_html( kb_profile_field( 'profile_role' ) ); ?></p>
				<p><?php echo nl2br( esc_html( kb_profile_field( 'profile_bio' ) ) ); ?></p>
				<?php kb_sns_links(); ?>
			</div>
		</div>

		<?php /* 固定ページ本文（管理画面から追記可能） */
		while ( have_posts() ) : the_post();
			if ( trim( get_the_content() ) ) : ?>
		<div class="profile-sec"><div class="entry-content"><?php the_content(); ?></div></div>
		<?php endif; endwhile; ?>

		<div class="profile-sec">
			<h2><span class="lbl">career</span>経歴</h2>
			<div class="timeline">
				<?php foreach ( kb_profile_lines( 'profile_career' ) as $line ) :
					$c = array_map( 'trim', explode( '|', $line, 3 ) ); ?>
				<div class="tl-item">
					<div class="d"><?php echo esc_html( $c[0] ); ?></div>
					<div class="t"><?php echo esc_html( isset( $c[1] ) ? $c[1] : '' ); ?></div>
					<?php if ( ! empty( $c[2] ) ) : ?><p><?php echo esc_html( $c[2] ); ?></p><?php endif; ?>
				</div>
				<?php endforeach; ?>
			</div>
		</div>

		<div class="profile-sec">
			<h2><span class="lbl">skills</span>スキル・強み</h2>
			<?php foreach ( kb_profile_lines( 'profile_skills' ) as $line ) :
				$g     = array_map( 'trim', explode( '|', $line, 2 ) );
				$chips = isset( $g[1] ) ? preg_split( '/[、,]/u', $g[1] ) : array(); ?>
			<div class="skill-group"><div class="g"><?php echo esc_html( $g[0] ); ?></div><?php
				foreach ( $chips as $chip ) {
					$chip = trim( $chip );
					if ( '' !== $chip ) { echo '<span class="chip"># ' . esc_html( $chip ) . '</span>'; }
				}
			?></div>
			<?php endforeach; ?>
		</div>

		<div class="profile-sec" id="research">
			<h2><span class="lbl">research</span>研究テーマ</h2>
			<p style="font-weight:700;margin-bottom:10px"><?php echo esc_html( kb_profile_field( 'profile_research_title' ) ); ?></p>
			<p style="font-size:14px;color:#4a4a4a"><?php echo nl2br( esc_html( kb_profile_field( 'profile_research_body' ) ) ); ?></p>
		</div>

		<div class="profile-sec">
			<h2><span class="lbl">activity</span>登壇・対外活動</h2>
			<ul style="list-style:disc;margin-left:20px;font-size:15px">
				<?php foreach ( kb_profile_lines( 'profile_activities' ) as $line ) : ?>
				<li style="margin-bottom:8px"><?php echo esc_html( $line ); ?></li>
				<?php endforeach; ?>
			</ul>
		</div>

		<div class="contact-cta">
			<p class="lbl">contact</p>
			<h2>お問い合わせ・ご相談</h2>
			<p>採用・案件・協業のご相談はお気軽にご連絡ください。</p>
			<a class="btn white" href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">お問い合わせ →</a>
		</div>

	</div>
</div>
<?php get_footer(); ?>
