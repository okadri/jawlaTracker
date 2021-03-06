app.service('stateService', function ($rootScope, $log, Person, PersonDiff) {
	function sortPeople(people) {
		people.ids.sort(function (id1, id2) {
			// By lastVisit
			var lastVisit1 = people.list[id1].visitHistory.length ? people.list[id1].visitHistory[0].date : 0;
			var lastVisit2 = people.list[id2].visitHistory.length ? people.list[id2].visitHistory[0].date : 0;
			if (lastVisit1 < lastVisit2) {
				return -1;
			} else if (lastVisit1 > lastVisit2) {
				return 1;
			}
			// By fullName
			var fullName1 = people.list[id1].fullName;
			var fullName2 = people.list[id2].fullName;
			if (fullName1 < fullName2) {
				return -1;
			} else if (fullName1 > fullName2) {
				return 1;
			}
			return 0;
		});
		return people;
	}

	return {
		_state: {},
		_personReducers: function (action, people) {
			var defaultPeople = {
				ids: [],
				list: {},
				mergeList: []
			};
			switch (action.type) {
				case GET_SHEET_ROWS:
					people = defaultPeople;
					var length = action.payload.rows ? action.payload.rows.length : 0;
					for (var i = 0; i < length; i++) {
						var rowData = action.payload.rows[i];
						var person = new Person(rowData, i);
						if (!person.isHidden) {
							people.list[i] = person;
							people.ids.push(i);
						}
					}
					return sortPeople(people);
				case GET_SHEET_ROW:
					var length = action.payload.rows ? action.payload.rows.length : 0;
					if (length === 1) {
						var rowData = action.payload.rows[0];
						var person = new Person(rowData, action.personId);
						if (!person.isHidden) {
							people.list[action.personId] = person;
						}
					}
					return sortPeople(people);
				case ADD_VISIT:
				case SET_VISITING_FLAG:
					people.list[action.payload.updatedPerson.id] = action.payload.updatedPerson;
					return sortPeople(people);
				case CREATE_PERSON:
				case UPDATE_PERSON:
					action.payload.updatedPerson.fullName = `${action.payload.updatedPerson.firstName} ${action.payload.updatedPerson.lastName}`;
					action.payload.updatedPerson.address.full = `${action.payload.updatedPerson.address.street}, ${action.payload.updatedPerson.address.city}, ${action.payload.updatedPerson.address.state} ${action.payload.updatedPerson.address.zipCode}`;
					people.list[action.payload.updatedPerson.id] = action.payload.updatedPerson;
					return sortPeople(people);
				case HIDE_PERSON:
					var index = people.ids.indexOf(action.payload.updatedPerson.id);
					people.ids.splice(index, 1);
					delete people.list[action.payload.updatedPerson.id]
					return sortPeople(people);
				case FILTER_PEOPLE:
					var searchTerm = action.payload.filters.searchTerm || '';
					var countries = action.payload.filters.countries || [];
					var languages = action.payload.filters.languages || [];
					var searchFields = ['fullName', 'address>full', 'notes'];
					people.ids.forEach(function (personId) {
						var person = people.list[personId];

						var matchesSearchTerm = !searchTerm || searchFields.some(function (sf) {
							var props = sf.split('>');
							var val = props.reduce(function (prev, current) {
								return prev[current];
							}, person);
							return val && val.toLowerCase().search(searchTerm.toLowerCase()) >= 0;
						});

						var matchesCountries = countries.length ? person.country && countries.some(function (c) {
							return c.code === person.country.code;
						}) : true;

						var matchesLanguages = languages.length ? person.languages && languages.some(function (l) {
							return person.languages.some(function (pl) { return pl.code == l.code });
						}) : true;

						person.isFiltered = !matchesSearchTerm || !matchesCountries || !matchesLanguages;
						return personId;
					});
					return sortPeople(people);
				case UPDATE_SIGNIN_STATUS:
					if (action.payload.isSignedIn == false) {
						people = defaultPeople;
					}
					return people;
				case POPULATE_MAP:
					action.payload.markers.forEach(function (person) {
						people.list[person.id] = person;
					});
					return people;
				case GET_MERGE_REPORT:
					people.mergeList.length = 0;
					var length = action.payload.rows ? action.payload.rows.length : 0;
					for (var i = 0; i < length; i++) {
						var rowData = action.payload.rows[i];
						var person = new Person(rowData, i);
						// Find if we have this person already based on full name
						var existingId = people.ids.find(function (id) {
							return people.list[id].fullName.toLowerCase() === person.fullName.toLowerCase();
						});

						if (existingId) {
							var existingPerson = people.list[existingId];
							// If the person exists, check if we need to update the address
							if (MD5(existingPerson.address.full) !== MD5(person.address.full)) {
								// Address on record differs, create the diff object
								people.mergeList.push(new PersonDiff(existingPerson, person));
							}
						} else {
							// Person is not on list, create a (create) diff object
							people.mergeList.push(new PersonDiff(new Person(), person));
						}
					}
					return people;
				case PERFORM_MERGE:
					people = action.payload.people;
					return sortPeople(people);
				case RESET_MERGE:
					people.mergeList.length = 0;
					return people;
				default:
					return people || defaultPeople;
			}
		},
		_uiReducers: function (action, ui) {
			var defaultUi = {
				displayMode: DISPLAY_MODE.LIST,
				platform: getMobileOperatingSystem(),
				isSignedIn: false,
				mapIsReady: false,
				mapIsPopulated: false,
				currentUser: undefined,
				filterable: false,
				filters: {},
				sheet: {},
				textMessage: "Salam, Came by to visit and missed you. We hope to see in in the masjid!",
				mergeStep: 0
			}
			switch (action.type) {
				case GET_SHEET_ROWS:
					ui.sheet.title = action.payload.title;
					ui.sheet.users = action.payload.users;
					ui.filters = {};
					// Set filterable to true if any row has a country code set
					ui.filterable = action.payload.rows.some(function (r) { return r[9] || r[10]; });
					return ui;
				case UPDATE_SIGNIN_STATUS:
					ui = ui || defaultUi;
					ui.isSignedIn = action.payload.isSignedIn;
					ui.sheet.id = action.payload.sheetId;
					ui.displayMode = DISPLAY_MODE.LIST;
					ui.currentUser = action.payload.currentUser
					return ui;
				case MAP_READY:
					ui = ui || defaultUi;
					ui.mapIsReady = true;
					return ui;
				case POPULATE_MAP:
					ui.mapIsPopulated = true;
					return ui;
				case SWITCH_DISPLAY_MODE:
					ui.displayMode = action.payload.mode || DISPLAY_MODE.LIST;
					return ui;
				case UPDATE_COUNTRY:
				case UPDATE_LANGUAGES:
					var hasCountry = !!action.payload.updatedPerson.country;
					var hasLanguages = action.payload.updatedPerson.languages && action.payload.updatedPerson.languages.length;
					// Set filterable to true if a country or a language was set
					ui.filterable = ui.filterable || hasCountry || hasLanguages;
					return ui;
				case FILTER_PEOPLE:
					var countries = action.payload.filters.countries || [];
					var languages = action.payload.filters.languages || [];
					if (countries.length || languages.length) {
						ui.filters.isFiltered = true;
					} else {
						ui.filters.isFiltered = false;
					}
					return ui;
				case GET_MERGE_REPORT:
					ui.mergeStep = 1;
					return ui;
				case PERFORM_MERGE:
				case RESET_MERGE:
					ui.mergeStep = 0;
					return ui;
				default:
					return ui || defaultUi;
			}
		},
		reduce: function (action) {
			var scope = this;

			if (!action || !action.type) {
				return;
			}

			newState = {};
			newState.people = scope._personReducers(action, scope._state.people);
			newState.ui = scope._uiReducers(action, scope._state.ui);

			scope._state = newState;
			$rootScope.$broadcast('stateChanged', {
				state: scope._state,
				action: action
			});

			$log.debug("State updated:");
			$log.debug(scope._state, action.type);
		},
		getState: function () {
			return this._state;
		}
	};
});