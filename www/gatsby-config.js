console.log(`${__dirname}/../docs`);
console.log(`${__dirname}/../fields/types`);

module.exports = {
	siteMetadata: {
		title: 'KeystoneJS',
	},
	plugins: [
		`gatsby-transformer-remark`,
		`gatsby-plugin-glamor`,
		`gatsby-plugin-offline`,
		`gatsby-plugin-sharp`,
		`gatsby-source-filesystem`,
		{
			resolve: `gatsby-plugin-google-analytics`,
			options: {
				trackingId: `UA-53647600-7`,
			},
		},
		{
			resolve: `gatsby-source-filesystem`,
			options: {
				name: `docs`,
				path: `${__dirname}/../docs`,
			},
		},
		{
			resolve: `gatsby-source-filesystem`,
			options: {
				name: `fields`,
				path: `${__dirname}/../fields/types`,
			},
		},
		{
			resolve: `gatsby-transformer-remark`,
			options: {
				plugins: [
					{
						resolve: `gatsby-remark-images`,
						options: {
							maxWidth: 800,
							wrapperStyle: `margin-bottom: 1.125rem;`,
						},
					},
					{
						resolve: `gatsby-remark-responsive-iframe`,
						options: {
							wrapperStyle: `margin-bottom: 1.125rem;`,
						},
					},
					`gatsby-remark-copy-linked-files`,
					`gatsby-remark-smartypants`,
					`gatsby-remark-prismjs`,
					{
						resolve: `gatsby-remark-autolink-headers`,
						options: {
							offsetY: 0,
						},
					},
				],
			},
		},
		{
			resolve: `gatsby-plugin-manifest`,
			options: {
				name: `KeystoneJS`,
				short_name: `KeystoneJS`,
				start_url: `/`,
				background_color: `white`,
				theme_color: `#056EA1`,
				display: `minimal-ui`,
			},
		},
	],
};
