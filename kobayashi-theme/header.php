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
		<a class="logo" href="<?php echo esc_url( home_url( '/' ) ); ?>">
			<img class="logo-img" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/logo-horizontal.svg' ); ?>" alt="<?php bloginfo( 'name' ); ?>" width="514" height="66">
		</a>

		<nav class="gnav" id="gnav">
			<?php
			if ( has_nav_menu( 'global' ) ) {
				wp_nav_menu( array( 'theme_location' => 'global', 'container' => false ) );
			} else {
				kb_default_nav();
			}
			?>
		</nav>

		<div class="h-right">
			<form class="search" role="search" method="get" action="<?php echo esc_url( home_url( '/' ) ); ?>">
				<button type="submit" aria-label="検索">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5C5C5C" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
				</button>
				<input type="text" name="s" value="<?php echo esc_attr( get_search_query() ); ?>" placeholder="フリーワードで検索">
			</form>
			<button class="menu-btn" id="menuBtn" aria-label="メニュー"><span></span><span></span><span></span></button>
		</div>
	</div>
</header>
