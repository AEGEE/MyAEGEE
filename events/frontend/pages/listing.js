(function ()
{
    'use strict';
    var baseUrl = baseUrlRepository['oms-events'];


    angular
        .module('app.listing', [])
        .config(config)
        .controller('EventsListingController', EventsListingController);

    /** @ngInject */
    function config($stateProvider)
    {
        // State
         $stateProvider
            .state('app.listing', {
                url: '/listing',
                data: {'pageTitle': 'All Events'},
                views   : {
                    'pageContent@app': {
                        templateUrl: baseUrl + 'frontend/pages/listing.html',
                        controller: 'EventsListingController as vm'
                    }
                }
            });
    }

    function EventsListingController($scope, $http) {        
	
		// Fetch events from backend
		$http.get(baseUrl).success(function(response) {
			$scope.events = response; 
		});
    }

})();

