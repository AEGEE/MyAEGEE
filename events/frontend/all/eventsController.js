(function ()
{
	'use strict';
	var baseUrl = baseUrlRepository['oms-events'];
	var apiUrl = baseUrl + 'api/';


	angular
		.module('app.events', [])
		.config(config)
		.controller('ListingController', ListingController)
		.controller('SingleController', SingleController)
		.controller('ApplyController', ApplyController)

	/** @ngInject */
	function config($stateProvider)
	{
		// State
		 $stateProvider
			.state('app.events', {
				url: '/events',
				data: {'pageTitle': 'All Events'},
				views   : {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/all/listing.html',
						controller: 'ListingController as vm'
					}
				}
			})
			.state('app.events.single', {
				url: '/single/:id',
				views: {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/all/single.html',
						controller: 'SingleController as vm'
					}
				}
			})
			.state('app.events.apply', {
				url: '/apply/:id',
				views: {
					'pageContent@app': {
						templateUrl: baseUrl + 'frontend/all/apply.html',
						controller: 'ApplyController as vm'
					}
				}
			});
	}

	function ListingController($scope, $http, $timeout) {        
	
		// Fetch events from backend
		//$('#loadingOverlay').show();
		$http.get(apiUrl).success(function(response) {
			$scope.events = response;
			//$('#loadingOverlay').hide();
		});


		// Display a nice ticking clock for the now timeline entry
		var tickInterval = 60000 //ms

		var tick = function() {
			$scope.currentTime = Date.now() // get the current time
			$timeout(tick, tickInterval); // reset the timer
		}
		tick();

		// Start the timer
		$timeout(tick, tickInterval);
		
		// Search callback to enable searching in name and description only
		$scope.search = function (row) {
			return (angular.lowercase(row.name).indexOf(angular.lowercase($scope.query) || '') !== -1 ||
					angular.lowercase(row.description).indexOf(angular.lowercase($scope.query) || '') !== -1);
		};
	}

	function SingleController($scope, $http, $stateParams) {
		$scope.baseUrl = baseUrl;

		// Fetch event from backend
		$http.get(apiUrl + 'single/' + $stateParams.id).success( function(res) {
			$scope.event = res; 
		});
	}

	function ApplyController($scope, $http, $stateParams) {

		// Fetch event again to get form fields
		// Also fetch if the user already has put an applicaiton
		var reqPromise = $http.get(apiUrl + 'single/' + $stateParams.id + '/participants/mine');
		$http.get(apiUrl + 'single/' + $stateParams.id).success( function(res) {
			// Save fetched event to scope
			$scope.event = res;

			// Poll for existing application
			reqPromise.success(function(res) {
				// Loop through application fields and assign them to our model
				res.application.forEach(function(field) {
					// Find the matching application_field to our users application field
					$scope.event.application_fields.some(function(item, index) {
						if(field.field_id == item._id) {
							$scope.event.application_fields[index].answer = field.value;
							return true;
						}
						return false;
					});
				});

				$scope.application_status = res.application_status;

			}).catch(function(err) {
				// User doesn't have submitted an application yet or something went wrong
			});

		});

		// Sumbit form callback
		$scope.submitForm = function() {
			// Copy data from the form into an object to submit it in the format the backend needs it
			var toServer = {application: []};
			$scope.event.application_fields.forEach(function(field) {
				if(field.answer) {
					toServer.application.push({
						field_id: field._id,
						value: field.answer
					});
				}
			});

			$http.put(apiUrl + 'single/' + $stateParams.id + '/participants/mine', toServer).then(function(res) {
				alert("application saved");
			}, function(err) {
				console.log(err);
			});
		}
	}

})();

