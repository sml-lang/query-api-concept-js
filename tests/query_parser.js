/* UTILITIES */

class BasicError extends Error {
	constructor(ctx, msg) {
		super()
		this.message = `${ctx.path.join('.')}: ${msg}`
	}
}

export class ErrInvalidPropertySelector extends BasicError {}
export class ErrUndefinedProperty extends BasicError {}
export class ErrUnknownListArgument extends BasicError {}
export class ErrMissingListArguments extends BasicError {}
export class ErrIllegalListArgumentsCombination extends BasicError {}
export class ErrMissingSelector extends BasicError {}
export class ErrUndefinedType extends BasicError {}
export class ErrMissingPageLimitArgument extends BasicError {}
export class ErrMismatchingTypes extends BasicError {}
export class ErrUnexpectedAttribute extends BasicError {}

/**
 * parseAliasedPropName parses an aliased property name and returns
 * the property name, and the alias name, or throws an exception if the
 * given propName isn't a valid aliased property name
 * 
 * @param String propName
 * 
 * @return Object{prop: string, alias: string}
 */
function parseAliasedPropName(ctx, propName) {
	const regexResult = regexAliasedProperty.exec(propName)
	if (regexResult === null) throw new ErrInvalidPropertySelector(
		ctx, `invalid property name: '${propName}'`,
	)

	return {
		prop:  regexResult[1],
		alias: regexResult[2],
	}
}

/* REGULAR EXPRESSIONS */

const entityIdentifier = /^([a-fA-F0-9]{8}[a-fA-F0-9]{4}[a-fA-F0-9]{4}[a-fA-F0-9]{4}[a-fA-F0-9]{12})$/
const regexAliasedProperty = /^([a-z][a-zA-Z0-9_]*) ?= ?(@[a-z][a-zA-Z0-9_]*)$/


/* TYPE FORWARD DECLARATIONS */

const types = {}

Object.defineProperties(types, {
	// root
	root: {value: {name: 'root'}},

	// Primitives
	Bool: {value: {name: 'Bool'}},
	Float64: {value: {name: 'Float64'}},
	Uint32: {value: {name: 'Uint32'}},
	Int32: {value: {name: 'Int32'}},
	String: {value: {name: 'String'}},
	Text: {value: {name: 'Text'}},
	Time: {value: {name: 'Time'}},
	
	// Scalars
	
	// Enums
	
	// Structs
	PersonName: {value: {name: 'PersonName'}},
	
	// Entities
	User: {value: {name: 'User'}},
	
	// Entity Identifiers
	ID_User: {value: {name: 'ID<User>'}},
	
	// Unions
	UserOrString: {value: {name: 'UserOrString'}},
	
	// Traits
})
Object.freeze(types)

/* TYPE IMPLEMENTATIONS */

// Graph Root
Object.defineProperties(types.root, {
	properties: {value: {
		users: {
			type: types.User,
			list: true,
			//evaluator: eval_root_users,
		},
	}},
})
//evaluator: eval_root

// Scalars

// Enums

// Structs
Object.defineProperties(types.PersonName, {
	properties: {value: {
		first: {
			type: types.Text,
			//evaluator: eval_PersonName_first,
		},
		last: {
			type: types.Text,
			//evaluator: eval_PersonName_last,
		},
	}},
})
//evaluator: eval_PersonName,

// Entities
Object.defineProperties(types.User, {
	properties: {value: {
		name: {
			type: types.PersonName,
			args: {
				exampleArg1: {
					type: types.ID_User,
					list: true,
				},
			},
			//evaluator: eval_User_name,
		},
		friends: {
			type: types.User,
			list: true,
			//evaluator: eval_User_friends,
		},
		partner: {
			type: types.UserOrString,
			optional: true,
			//evaluator: eval_User_partner,
		},
		birthDate: {
			type: types.Time,
			args: {
				exampleArg2: {
					type: types.Time,
					optional: true,
				},
			},
			//evaluator: eval_User_birthDate,
		},
	}},
})
//evaluator: eval_User

// Entity Identifiers
Object.defineProperties(types.ID_User, {
	constructor: {value: function(value) {
		// Validate value
		if (!entityIdentifier.test(value)) throw new ErrMismatchingTypes(
			'illegal value for ID<User>',
		)
	
		this.value = value
	}},
})

// Unions
Object.defineProperties(types.UserOrString, {
	types: {value: [
		types.User,
		types.String,
	]},
})

// Traits

/* CONSTRUCTORS */

const constructors = {}
Object.defineProperties(constructors, {
	id: {value: {
		User: types.ID_User.constructor,
	}},
	struct: {value: {
		PersonName: types.PersonName.constructor,
	}},
})
Object.freeze(constructors)





/**
 * Context is used for tracking the evaluator context
 * throughout the query tree traversal
 * 
 * @param String parent
 * @param String nextToken
 */
function Context(parent, nextToken) {
	Object.defineProperty(this, 'path', {
		value: parent instanceof Context ?
			parent.path.concat(nextToken) : [parent]
	})
	Object.defineProperty(this, 'new', {
		value: function(nextPathToken) {
			return new Context(this, nextPathToken)
		}
	})
}










/**
 * ...
 * 
 * @param Object query
 */
export function evaluate(query) {
	const ctx = new Context('root')
	for (const propName in query) {
		if (propName in types.root.properties) {
			evaluateProperty(
				ctx,
				types.root.properties[propName],
				query[propName],
				propName,
			)
			continue
		}

		const aliasedName = parseAliasedPropName(ctx, propName)
		if (aliasedName.prop in types.root.properties) {
			evaluateProperty(
				ctx,
				types.root.properties[aliasedName.prop],
				query[propName],
				aliasedName.prop,
				aliasedName.alias,
			)
			continue
		}

		throw new ErrUndefinedProperty(
			ctx, `undefined property: '${propName}'`
		)
	}
}

/**
 * ...
 * 
 * @param Context ctx
 * @param Object listArgs
 */
function checkListArgIntegrity(ctx, listArgs) {
	// Ensure all provided arguments are legal
	for (const arg in listArgs) switch(arg) {
	case 'ids':
	case 'after':
	case 'limit':
		continue
	default:
		throw new ErrUnknownListArgument(ctx, `unknown list argument: ${arg}`)
	}

	// Ensure at least some arguments are provided
	if (!listArgs.ids && !listArgs.limit) {
		if (listArgs.after) throw new ErrMissingPageLimitArgument(
			ctx, `missing page limit argument`,
		)
		throw new ErrMissingListArguments(ctx, `missing list arguments`)
	}

	// Ensure ids and after or limit are not provided at the same time
	if (listArgs.ids && (listArgs.after || listArgs.limit)) {
		throw new ErrIllegalListArgumentsCombination(
			ctx,
			`illegal combination of list arguments: ${Object.keys(listArgs)}`,
		)
	}
}

/**
 * ...
 * 
 * @param Context ctx
 * @param Object expected
 * @param Object actual
 */
function evaluateSelection(ctx, expected, actual) {
	// Ensure at least one element is selected
	if (Object.keys(actual).length < 1) throw new ErrMissingSelector(
		ctx, `empty selector`,
	)

	// Verify selected elements
	for (const selected in actual) {
		if (!(selected in expected)) throw new ErrUndefinedProperty(
			ctx, `unexpected selection: ${selected}`,
		)
		// console.log('\tSelected', selected, 'in', ctx.path.join('.')) // DEBUG
	}
}

/**
 * ...
 * 
 * @param Context ctx
 * @param Object expectedTypes
 * @param Object acceptedTypes
 */
function checkTypeAcceptIntegrity(ctx, expectedTypes, acceptedTypes) {
	for (const acceptedType in acceptedTypes) {
		if (!(acceptedType in expectedTypes)) {
			// Ensure the type is defined at least
			if (!(acceptedType in types)) throw new ErrUndefinedType(
				ctx, `undefined type: ${acceptedType}`,
			)

			throw new ErrUndefinedType(ctx, `undefined type: ${acceptedType}`)
		}
	}
}

/**
 * ...
 * 
 * @param Context ctx
 * @param Object expected
 * @param Object prop
 * @param String propName
 * @param String alias
 */
function evaluateProperty(ctx, expected, prop, propName, alias) {
	// console.warn(
	// 	'prop',
	// 	`\n\tname: ${propName}`,
	// 	`\n\talias: ${alias}`,
	// 	'\n\texpected:', expected,
	// 	'\n\tprop:', prop,
	// ) // DEBUG
	ctx = ctx.new(propName)

	const expectedAttributes = {args: true}

	if (expected.list) expectedAttributes.listArgs = true
	if (expected.type.properties) expectedAttributes.select = true
	if (expected.type.types) expectedAttributes.accept = true

	// Check attribute integrity
	// For each attribute in property check if attribute is not expected
	for (const attr in prop) if (!(attr in expectedAttributes)) {
		throw new ErrUnexpectedAttribute(ctx, `unexpected attribute ${attr}`)
	}

	// Check list arguments integrity if this property is a list
	if (expectedAttributes.listArgs) checkListArgIntegrity(
		ctx, prop.listArgs,
	)

	// Check accepted types integrity if this property is a union
	if (expectedAttributes.accept) checkTypeAcceptIntegrity(
		ctx, expected.types, prop.accept,
	)

	// Evaluate selected elements
	if (expectedAttributes.select) evaluateSelection(
		// Check element selection integrity
		ctx, expected.type.properties, prop.select,
	)

	// for (const subProp in prop) console.log('subProp:', subProp) // DEBUG
	// console.log('')
}
