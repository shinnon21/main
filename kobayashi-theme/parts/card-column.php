<?php /* 記事横型カード（コラム一覧・検索結果用） */ ?>
<a class="article" href="<?php the_permalink(); ?>">
	<?php kb_thumb( 'a-thumb' ); ?>
	<div class="a-body">
		<div class="meta">
			<?php kb_dates(); ?>
			<span class="badge accent" style="font-size:10px"><?php echo esc_html( get_post_type_object( get_post_type() )->labels->singular_name ); ?></span>
		</div>
		<h3><?php the_title(); ?></h3>
		<?php kb_skill_chips( 3, false ); ?>
	</div>
</a>
