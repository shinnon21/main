<?php
/**
 * Template Name: プロフィール
 * 設計書 §5.8。経歴・スキル等は初期データを直書き（後で管理画面編集に移行可）
 */
get_header();
get_template_part( 'parts/page-hero', null, array( 'label' => 'profile', 'title' => kb_t( 'プロフィール', 'Profile' ) ) );
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
			</div>
		</div>

		<?php /* 固定ページ本文（管理画面から追記可能） */
		while ( have_posts() ) : the_post();
			$kb_body = kb_is_en() ? get_post_meta( get_the_ID(), 'content_en', true ) : '';
			if ( trim( $kb_body ) || trim( get_the_content() ) ) : ?>
		<div class="profile-sec"><div class="entry-content"><?php kb_the_content(); ?></div></div>
		<?php endif; endwhile; ?>

		<div class="profile-sec">
			<h2><span class="lbl">career</span><?php echo esc_html( kb_t( '経歴', 'Career' ) ); ?></h2>
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
			<h2><span class="lbl">skills</span><?php echo esc_html( kb_t( 'スキル・強み', 'Skills & Strengths' ) ); ?></h2>
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
			<h2><span class="lbl">research</span><?php echo esc_html( kb_t( '研究テーマ', 'Research' ) ); ?></h2>
			<p style="font-weight:700;margin-bottom:10px"><?php echo esc_html( kb_profile_field( 'profile_research_title' ) ); ?></p>
			<p style="font-size:14px;color:#4a4a4a"><?php echo nl2br( esc_html( kb_profile_field( 'profile_research_body' ) ) ); ?></p>
		</div>

		<div class="profile-sec">
			<h2><span class="lbl">activity</span><?php echo esc_html( kb_t( '登壇・対外活動', 'Talks & Activities' ) ); ?></h2>
			<ul style="list-style:disc;margin-left:20px;font-size:15px">
				<?php foreach ( kb_profile_lines( 'profile_activities' ) as $line ) : ?>
				<li style="margin-bottom:8px"><?php echo esc_html( $line ); ?></li>
				<?php endforeach; ?>
			</ul>
		</div>

		<div class="profile-sec">
			<h2><span class="lbl">follow</span><?php echo esc_html( kb_t( 'SNSアカウント', 'Social Media' ) ); ?></h2>
			<?php kb_sns_links( 'tiles' ); ?>
		</div>

		<div class="contact-cta">
			<p class="lbl">contact</p>
			<h2><?php echo esc_html( kb_t( 'お問い合わせ・ご相談', 'Contact & Inquiries' ) ); ?></h2>
			<p><?php echo esc_html( kb_t( '案件のご相談、取材・登壇のご依頼、協業のお声がけなど、お気軽にご連絡ください。', 'For project inquiries, interview and speaking requests, or collaboration proposals — please feel free to reach out.' ) ); ?></p>
			<a class="btn white" href="<?php echo esc_url( kb_home( '/contact/' ) ); ?>"><?php echo esc_html( kb_t( 'お問い合わせ →', 'Contact →' ) ); ?></a>
		</div>

	</div>
</div>
<?php get_footer(); ?>
