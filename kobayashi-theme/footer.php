<footer class="site-footer">
	<div class="container">
		<div class="top">
			<div class="f-logo">
				<span class="jp"><?php bloginfo( 'name' ); ?></span>
				<span class="sub">shinnosuke-kobayashi.jp</span>
				<p><?php bloginfo( 'description' ); ?></p>
				<?php /* プロフィールと同じアカウント群をアイコンのみで表示（kb_sns_accounts が正） */ ?>
				<?php kb_sns_links( 'icons' ); ?>
			</div>
			<div>
				<h4>sitemap</h4>
				<ul class="links">
					<li><a href="<?php echo esc_url( get_post_type_archive_link( 'works' ) ); ?>">実績</a></li>
					<li><a href="<?php echo esc_url( get_post_type_archive_link( 'column' ) ); ?>">コラム</a></li>
					<li><a href="<?php echo esc_url( get_post_type_archive_link( 'news' ) ); ?>">お知らせ</a></li>
					<li><a href="<?php echo esc_url( home_url( '/profile/' ) ); ?>">プロフィール</a></li>
					<li><a href="<?php echo esc_url( home_url( '/searches/' ) ); ?>">条件から探す</a></li>
				</ul>
			</div>
			<div>
				<h4>links</h4>
				<ul class="links">
					<li><a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">お問い合わせ</a></li>
					<li><a href="<?php echo esc_url( home_url( '/about/' ) ); ?>">About（このサイトについて）</a></li>
					<li><a href="<?php echo esc_url( home_url( '/privacy/' ) ); ?>">プライバシーポリシー</a></li>
					<li><a href="https://www.weeave.co.jp/" target="_blank" rel="noopener">Weeave株式会社 ↗</a></li>
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
