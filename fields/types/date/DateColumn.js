import React from 'react';
import moment from 'moment';
import ItemsTableCell from '../../components/ItemsTableCell';
import ItemsTableValue from '../../components/ItemsTableValue';

var DateColumn = React.createClass({
	displayName: 'DateColumn',
	propTypes: {
		col: React.PropTypes.object,
		data: React.PropTypes.object,
		linkTo: React.PropTypes.string,
	},
	getValue () {
		const value = this.props.data.fields[this.props.col.path];
		if (!value) return null;

		// [formate time by xiaoTuiMao · Pull Request #3896 · keystonejs/keystone](https://github.com/keystonejs/keystone/pull/3896)
		const format = this.props.col.field.formatString || ((this.props.col.type === 'datetime') ? 'MMMM Do YYYY, h:mm:ss a' : 'MMMM Do YYYY');
		return moment(value).format(format);
	},
	render () {
		const value = this.getValue();
		const empty = !value && this.props.linkTo ? true : false;
		return (
			<ItemsTableCell>
				<ItemsTableValue field={this.props.col.type} to={this.props.linkTo} empty={empty}>
					{value}
				</ItemsTableValue>
			</ItemsTableCell>
		);
	},
});

module.exports = DateColumn;
