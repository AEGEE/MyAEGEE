(function ()
{
	'use strict';
	var baseUrl = baseUrlRepository['oms-events'];
	var apiURL = baseUrl + 'api/';


	angular
		.module('app.events', [])
		.config(config)
		.controller('ListingController', ListingController)
		.controller('SingleController', SingleController)

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
			});
	}

	function ListingController($scope, $http) {        
	
		// Fetch events from backend
		$http.get(apiURL).success(function(response) {
			$scope.events = response; 
		});
	}

	function SingleController($scope, $http, $stateParams) {

		$http.get(apiURL + 'single/' + $stateParams.id).success( function(response) {
			$scope.event = response; 
		});
	}

})();

