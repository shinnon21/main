<footer class="site-footer">
	<div class="container">
		<div class="top">
			<div class="f-logo">
				<span class="jp"><?php bloginfo( 'name' ); ?></span>
				<span class="sub">shinnosuke-kobayashi.jp</span>
				<p><?php echo esc_html( kb_t( get_bloginfo( 'description' ), 'From political and governmental DX to pharmaceutical supply chain research — the official website of Shinnosuke Kobayashi, an aspiring coordinator who delivers Japanese technology to society.' ) ); ?></p>
				<?php /* プロフィールと同じアカウント群をアイコンのみで表示（kb_sns_accounts が正） */ ?>
				<?php kb_sns_links( 'icons' ); ?>
			</div>
			<div>
				<h4>sitemap</h4>
				<ul class="links">
					<li><a href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>"><?php echo esc_html( kb_t( '実績', 'Works' ) ); ?></a></li>
					<li><a href="<?php echo esc_url( get_post_type_archive_link( 'column' ) ); ?>"><?php echo esc_html( kb_t( 'コラム', 'Column' ) ); ?></a></li>
					<li><a href="<?php echo esc_url( get_post_type_archive_link( 'news' ) ); ?>"><?php echo esc_html( kb_t( 'お知らせ', 'News' ) ); ?></a></li>
					<li><a href="<?php echo esc_url( kb_home( '/profile/' ) ); ?>"><?php echo esc_html( kb_t( 'プロフィール', 'Profile' ) ); ?></a></li>
					<li><a href="<?php echo esc_url( kb_home( '/searches/' ) ); ?>"><?php echo esc_html( kb_t( '条件から探す', 'Advanced search' ) ); ?></a></li>
				</ul>
			</div>
			<div>
				<h4>links</h4>
				<ul class="links">
					<li><a href="<?php echo esc_url( kb_home( '/contact/' ) ); ?>"><?php echo esc_html( kb_t( 'お問い合わせ', 'Contact' ) ); ?></a></li>
					<li><a href="<?php echo esc_url( kb_home( '/about/' ) ); ?>"><?php echo esc_html( kb_t( 'About（このサイトについて）', 'About this site' ) ); ?></a></li>
					<li><a href="<?php echo esc_url( kb_home( '/privacy/' ) ); ?>"><?php echo esc_html( kb_t( 'プライバシーポリシー', 'Privacy Policy' ) ); ?></a></li>
					<li><a href="https://www.weeave.co.jp/" target="_blank" rel="noopener"><?php echo esc_html( kb_t( 'Weeave株式会社 ↗', 'Weeave Inc. ↗' ) ); ?></a></li>
				</ul>
			</div>
		</div>
		<div class="bottom">
			<span class="en">© <?php echo esc_html( date_i18n( 'Y' ) ); ?> Shinnosuke Kobayashi</span>
		</div>
	</div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
