import {ErrInvalidPropertySelector, evaluate} from './query_parser'

describe('Undefined Root Property', () => {
	it('should ', () => {
		expect(() => evaluate({
			wrongProp: {},
		})).toThrow(ErrInvalidPropertySelector)
	})
})
