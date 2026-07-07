<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

<header class="site">
	<div class="container">
		<a class="logo" href="<?php echo esc_url( kb_home( '/' ) ); ?>">
			<?php /* ?v= はロゴ差し替え時のブラウザキャッシュ対策（テーマVersion連動） */ ?>
			<img class="logo-img" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/logo-horizontal.svg?v=' . wp_get_theme()->get( 'Version' ) ); ?>" alt="<?php bloginfo( 'name' ); ?>" width="575" height="58">
		</a>

		<nav class="gnav" id="gnav">
			<?php
			if ( has_nav_menu( 'global' ) ) {
				wp_nav_menu( array( 'theme_location' => 'global', 'container' => false ) );
			} else {
				kb_default_nav();
			}
			?>
			<?php /* モバイルの全画面メニュー内のみ表示（言語切替・検索・SNS・CTA） */ ?>
			<div class="gnav-extra">
				<?php kb_lang_switcher(); ?>
				<form class="search" role="search" method="get" action="<?php echo esc_url( kb_home( '/' ) ); ?>">
					<button type="submit" aria-label="検索">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C5C5C" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
					</button>
					<input type="text" name="s" value="<?php echo esc_attr( get_search_query() ); ?>" placeholder="<?php echo esc_attr( kb_t( 'フリーワードで検索', 'Search' ) ); ?>">
				</form>
				<?php kb_sns_links(); ?>
				<a class="btn primary" href="<?php echo esc_url( kb_home( '/contact/' ) ); ?>"><?php echo esc_html( kb_t( 'お問い合わせ →', 'Contact →' ) ); ?></a>
			</div>
		</nav>

		<div class="h-right">
			<form class="search" role="search" method="get" action="<?php echo esc_url( kb_home( '/' ) ); ?>">
				<button type="submit" aria-label="検索">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C5C5C" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
				</button>
				<input type="text" name="s" value="<?php echo esc_attr( get_search_query() ); ?>" placeholder="<?php echo esc_attr( kb_t( 'フリーワードで検索', 'Search' ) ); ?>">
			</form>
			<button class="menu-btn" id="menuBtn" aria-label="メニュー" aria-controls="gnav" aria-expanded="false"><span></span><span></span><span></span></button>
		</div>
	</div>
</header>
